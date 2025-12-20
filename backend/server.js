<<<<<<< HEAD
const express = require('express');
const PocketBase = require('pocketbase');
const app = express();
const port = 3000;

const pb = new PocketBase({
  url: 'http://localhost:8090', // URL de Pocketbase
});

const productsRoutes = require('./routes/products');
const storesRoutes = require('./routes/stores');
const usersRoutes = require('./routes/users');
const ordersRoutes = require('./routes/orders');
const affiliatesRoutes = require('./routes/affiliates');

app.use('/api/products', productsRoutes);
app.use('/api/stores', storesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/affiliates', affiliatesRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
=======
// backend/server.js
app.post('/api/import', async (req, res) => {
  const data = req.body;
  // Lógica para importar datos a Pocketbase
  res.status(200).send('Datos importados con éxito');
>>>>>>> origin/main
});