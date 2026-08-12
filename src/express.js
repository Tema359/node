import express, { Router } from 'express';

const PORT = process.env.PORT || 3000;

const users = Router();

const getAllUsers = async () => {
  const response = await fetch('https://jsonplaceholder.typicode.com/users');
  return response.json();
};

const getUserById = async (id) => {
  const response = await fetch(
    `https://jsonplaceholder.typicode.com/users/${id}`,
  );
  return response.json();
};

users.get('/', async (req, res) => {
  const allUsers = await getAllUsers();
  res.json(allUsers);
});

users.get('/:id', async (req, res) => {
  const user = await getUserById(req.params.id);
  res.json(user);
});

const app = express();
app.get('/health', (req, res) => res.send('ok'));

app.use('/users', users);

app.use((req, res) => {
  res.status(404).send('Not found');
});

app.listen(PORT, () => console.log(`Server is running on port: ${PORT}`));
