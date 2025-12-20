// js/app.js
const pb = new PocketBase({
  url: 'http://localhost:8090' // URL de tu servidor de Pocketbase
});

async function addProduct() {
  try {
    const response = await pb.collection('products').create({
        name: 'Nuevo Producto',
        description: 'Descripción del nuevo producto',
        price: 100,
        category: 'Electrónica'
    });
    console.log('Producto agregado:', response);
    alert('Producto agregado con éxito.');
  } catch (error) {
    console.error('Error al agregar producto:', error);
    alert('Error al agregar producto');
  }
}

async function updateProduct() {
  try {
    const response = await pb.collection('products').update(1, {
        name: 'Producto Modificado',
        description: 'Descripción modificada',
        price: 150,
        category: 'Electrónica'
    });
    console.log('Producto modificado:', response);
    alert('Producto modificado con éxito.');
  } catch (error) {
    console.error('Error al modificar producto:', error);
    alert('Error al modificar producto');
  }
}

async function deleteProduct() {
  try {
    const response = await pb.collection('products').delete(1);
    console.log('Producto eliminado:', response);
    alert('Producto eliminado con éxito.');
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    alert('Error al eliminar producto');
  }
}