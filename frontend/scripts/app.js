const pb = new PocketBase({
  url: 'http://localhost:8090' // URL de Pocketbase
});

// Funciones para interactuar con Pocketbase
async function fetchProducts() {
  const products = await pb.collection('products').find({});
  console.log(products);
}

document.addEventListener('DOMContentLoaded', fetchProducts);