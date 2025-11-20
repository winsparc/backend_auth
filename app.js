const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path'); 
const app = express();
const cors = require('cors'); 

const multer = require('multer');
app.use(express.json());
app.use(cors()); 
const pool = mysql.createPool({
  host: 'localhost', 
  user: 'root', 
  password: '',
  database: 'test_db' 
});

const JWT_SECRET = 'your_jwt_secret_key'; 


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.post('/register', upload.single('image'), (req, res) => {
  const { name, email, password, age } = req.body;
  const image = req.file ? req.file.filename : null;
  if (!name || !email || !password || !age) {
    return res.status(400).json({ message: 'All fields are required!' });
  }

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ message: 'Error hashing password' });
    }

    const query = 'INSERT INTO users (name, email, password, age, image) VALUES (?, ?, ?, ?, ?)';
    pool.execute(query, [name, email, hashedPassword, age, image], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Error inserting user into database', error: err });
      }
      res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
    });
  });
});


app.get('/register-form', (req, res) => {
  res.send(`
    <h2>User Registration</h2>
    <form action="/register" method="POST" enctype="multipart/form-data">
      <label>Name:</label><br>
      <input type="text" name="name" required><br><br>

      <label>Email:</label><br>
      <input type="email" name="email" required><br><br>

      <label>Password:</label><br>
      <input type="password" name="password" required><br><br>

      <label>Age:</label><br>
      <input type="number" name="age" required><br><br>

      <label>Upload Image:</label><br>
      <input type="file" name="image" required><br><br>

      <button type="submit">Register</button>
    </form>
  `);
});


const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1]; 

  if (!token) {
    return res.status(403).json({ message: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = decoded; 
    next(); 
  });
};



app.get('/users-list', (req, res) => {
  const query = 'SELECT id, name, email, age, image FROM users';  

  pool.execute(query, (err, result) => {
    if (err) {
      return res.status(500).send(`
        <h2>Error</h2>
        <p>Failed to load users: ${err.message}</p>
        <a href="/register-form">Back to Registration</a>
      `);
    }

    if (result.length === 0) {
      return res.send(`
        <h2>Users List</h2>
        <p>No users found. <a href="/register-form">Register the first user!</a></p>
      `);
    }

    let tableRows = '';
    result.forEach(user => {
      const imageHtml = user.image 
        ? `<img src="/uploads/${user.image}" alt="${user.name}'s avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`
        : '<span style="width: 40px; height: 40px; border-radius: 50%; background: #ddd; display: inline-block; text-align: center; line-height: 40px;">?</span>';
      
      tableRows += `
        <tr>
          <td>${user.id}</td>
          <td>${user.name}</td>
          <td>${user.email}</td>
          <td>${user.age}</td>
          <td>${imageHtml}</td>
        </tr>
      `;
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Users List</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f4f4f4; }
          h2 { color: #333; }
          table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #4CAF50; color: white; }
          tr:hover { background: #f1f1f1; }
          .nav { margin-bottom: 20px; }
          a { color: #4CAF50; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="nav">
          <a href="/register-form">← Back to Registration</a> | 
          <a href="/users-list">Refresh List</a>
        </div>
        <h2>Users List (${result.length} users)</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Age</th>
              <th>Avatar</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>
    `);
  });
});

app.get('/user', (req, res) => {
  const query = 'SELECT id, name, email, age, image FROM users';  

  pool.execute(query, (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching users from database', error: err });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }

    res.json(result);  
  });
});


app.get('/user-all/:id', verifyToken, (req, res) => {
  const { id } = req.params; 
  const query = `
    SELECT u.*, s.salary, s.bonus
    FROM users u
    LEFT JOIN salary s ON u.id = s.employee_id
  `;

  pool.execute(query, (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(result);
  });
});


app.put('/user/:id', verifyToken, (req, res) => {
  const { id } = req.params;  
  const { name, email, age } = req.body;  

  if (id !== req.user.userId) {
    return res.status(403).json({ message: 'You are not authorized to update this user\'s data' });
  }

  if (!name || !email || !age) {
    return res.status(400).json({ message: 'All fields (name, email, age) are required!' });
  }

  const query = 'UPDATE users SET name = ?, email = ?, age = ? WHERE id = ?';
  
  pool.execute(query, [name, email, age, id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Error updating user data', error: err });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user: {
        id,
        name,
        email,
        age
      }
    });
  });
});


app.get('/user/:id', verifyToken, (req, res) => {
  const userId = req.params.id; 
  const query = 'SELECT id, name, email, age FROM users WHERE id = ?';  

  pool.execute(query, [userId], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching user from database', error: err });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result[0];  
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      age: user.age
    });
  });
});


app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required!' });
  }

  const query = 'SELECT * FROM users WHERE email = ?';
  pool.execute(query, [email], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching user from database', error: err });
    }
    if (result.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const user = result[0];

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ message: 'Error comparing passwords' });
      }
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid email or password' });
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    
      res.json({
        message: 'Login successful',
        token: token,  
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          age: user.age
        }
      });
    });
  });
});


const port = 3000;
app.listen(port, '0.0.0.0', () => {  // Added '0.0.0.0' to bind to all interfaces (for 10.229.74.113 access)
  console.log(`Server is running on http://0.0.0.0:${port}`);
});


// const port = 3000;
// app.listen(port, () => {
//   console.log(`Server is running on http://localhost:${port}`);
// });