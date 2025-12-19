
const pb = new PocketBase({
  url: 'http://localhost:8090' // URL de tu servidor de Pocketbase
});

async function fetchFromBackend(endpoint, method = 'GET', data = null) {
  const url = `https://pati-platform.onrender.com${endpoint}`;
  const response = await fetch(url, {
     method: method,
     headers: {
       'Content-Type': 'application/json',
     },
     body: data ? JSON.stringify(data) : null,
   });
   return response.json();
}
// backend/server.js
const express = require('express');
const app = express();
const port = 3000;

// Endpoint para obtener productos
app.get('/api/products', async (req, res) => {
  try {
    const products = await getProducts(); // Asegúrate de que esta función esté implementada
    res.json(products);
   } catch (error) {
     res.status(500).send('Error getting products');
    }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
// backend/server.js
async function getProducts() {
  const products = await pb.collection('products').find({});
  return products;
}