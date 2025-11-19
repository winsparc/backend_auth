const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();

const multer = require('multer');
app.use(express.json());


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

app.post('/register',  upload.single('image'), (req, res) => {
  const { name, email, password, age } = req.body;
const image = req.file ? req.file.filename : null;
  if (!name || !email || !password || !age) {
    return res.status(400).json({ message: 'All fields are required!' });
  }

 
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ message: 'Error hashing password' });
    }

    
    const query = 'INSERT INTO users (name, email, password, age,image) VALUES (?, ?, ?, ?,?)';
    pool.execute(query, [name, email, hashedPassword, age,image], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Error inserting user into database', error: err });
      }
      res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
    });
  });
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


// app.get('/user', verifyToken, (req, res) => {
//  const query = 'SELECT id, name, email, age FROM users';  

//   pool.execute(query, (err, result) => {
//     if (err) {
//       return res.status(500).json({ message: 'Error fetching users from database', error: err });
//     }

//     if (result.length === 0) {
//       return res.status(404).json({ message: 'No users found' });
//     }

//     res.json(result);  
//   });
// });



app.get('/user',  (req, res) => {
 const query = 'SELECT id, name, email, age,image FROM users';  

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
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
