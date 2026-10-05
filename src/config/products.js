// Catálogo de la demo. Precios FICTICIOS, solo con fines demostrativos.

export const SECTIONS = [
  { id: 'granos', name: 'Granos y cereales', aisle: 1, style: 'shelf' },
  { id: 'pan', name: 'Pan y alimentos básicos', aisle: 1, style: 'shelf' },
  { id: 'lacteos', name: 'Lácteos', aisle: 2, style: 'fridge' },
  { id: 'bebidas', name: 'Bebidas y productos esenciales', aisle: 2, style: 'shelf' },
  { id: 'carnes', name: 'Carnes', aisle: 3, style: 'fridge' },
  { id: 'frutas', name: 'Frutas y verduras', aisle: 3, style: 'crates' },
];

// shape → generador en scene/productMeshes.js
export const PRODUCTS = [
  // Granos y cereales
  { id: 'arroz', name: 'Arroz', detail: 'Bolsa 1 kg', price: 2.40, section: 'granos', list: true, shape: 'bag', color: '#FFFFFF', accent: '#E0A32E', ink: '#7A4B00', dims: [0.13, 0.21, 0.065] },
  { id: 'frijoles', name: 'Frijoles', detail: 'Bolsa 1 kg', price: 2.15, section: 'granos', list: true, shape: 'bag', color: '#F3E6D2', accent: '#6B2E1F', ink: '#4A1F14', dims: [0.13, 0.21, 0.065] },
  { id: 'harina', name: 'Harina de maíz', detail: 'Bolsa 1 kg', price: 1.65, section: 'granos', list: false, shape: 'bag', color: '#FFF4CF', accent: '#E8B21C', ink: '#6E4F00', dims: [0.14, 0.23, 0.07] },
  { id: 'avena', name: 'Avena', detail: 'Bolsa 800 g', price: 1.90, section: 'granos', list: false, shape: 'bag', color: '#EAD9B8', accent: '#3B7A2A', ink: '#2F4A1C', dims: [0.12, 0.2, 0.06] },

  // Pan y alimentos básicos
  { id: 'pan', name: 'Pan', detail: 'Pieza 680 g', price: 2.10, section: 'pan', list: true, shape: 'loaf', color: '#FFFFFF', accent: '#C98A43', ink: '#6B3B12' },
  { id: 'tortillas', name: 'Tortillas', detail: 'Paquete 1 kg', price: 1.35, section: 'pan', list: false, shape: 'tortillas', color: '#E9D7A8', accent: '#3B7A2A', ink: '#3F2E10' },
  { id: 'azucar', name: 'Azúcar', detail: 'Bolsa 1 kg', price: 1.95, section: 'pan', list: true, shape: 'bag', color: '#FFFFFF', accent: '#2F7BC0', ink: '#123B66', dims: [0.13, 0.21, 0.065] },
  { id: 'sal', name: 'Sal', detail: 'Bote 1 kg', price: 0.75, section: 'pan', list: false, shape: 'canister', color: '#1E64B4', accent: '#FFFFFF', ink: '#FFFFFF' },

  // Lácteos
  { id: 'leche', name: 'Leche', detail: 'Caja 1 L', price: 1.80, section: 'lacteos', list: true, shape: 'carton', color: '#FFFFFF', accent: '#2C7FD0', ink: '#0F3E6E' },
  { id: 'huevos', name: 'Huevos', detail: 'Docena', price: 3.25, section: 'lacteos', list: true, shape: 'eggs', color: '#D9CDBA', accent: '#E07B16', ink: '#5A3A10' },
  { id: 'queso', name: 'Queso', detail: 'Pieza 400 g', price: 3.75, section: 'lacteos', list: true, shape: 'cheese', color: '#F4E7B5', accent: '#C0392B', ink: '#5B1A12' },
  { id: 'yogur', name: 'Yogur', detail: 'Vaso 1 kg', price: 1.55, section: 'lacteos', list: false, shape: 'yogurt', color: '#FFFFFF', accent: '#D6336C', ink: '#7A1238' },

  // Bebidas y productos esenciales
  { id: 'aceite', name: 'Aceite', detail: 'Botella 1 L', price: 3.60, section: 'bebidas', list: true, shape: 'bottle', color: '#E7B021', accent: '#2E7D32', ink: '#1F4D22', liquid: true },
  { id: 'agua', name: 'Agua', detail: 'Botella 1.5 L', price: 0.85, section: 'bebidas', list: false, shape: 'bottle', color: '#BFE3F2', accent: '#1E88E5', ink: '#0D3C66' },
  { id: 'jabon', name: 'Jabón', detail: 'Barra 150 g', price: 0.95, section: 'bebidas', list: false, shape: 'soap', color: '#E8F4FB', accent: '#00897B', ink: '#00473F' },
  { id: 'papel', name: 'Papel higiénico', detail: '4 rollos', price: 2.30, section: 'bebidas', list: false, shape: 'paper', color: '#FFFFFF', accent: '#5C6BC0', ink: '#283593' },

  // Carnes
  { id: 'pollo', name: 'Pollo', detail: 'Bandeja 1 kg', price: 5.90, section: 'carnes', list: true, shape: 'tray', color: '#F0C9A8', accent: '#E57A00', ink: '#6B3300', meat: 'pollo' },
  { id: 'res', name: 'Carne de res', detail: 'Bandeja 500 g', price: 4.80, section: 'carnes', list: false, shape: 'tray', color: '#A8323A', accent: '#8E1B22', ink: '#5A0F14', meat: 'res' },

  // Frutas y verduras
  { id: 'tomate', name: 'Tomate', detail: '1 kg', price: 1.45, section: 'frutas', list: true, shape: 'produce', kind: 'tomate', color: '#D7261E', accent: '#D7261E', ink: '#5A0A06' },
  { id: 'cebolla', name: 'Cebolla', detail: '1 kg', price: 1.10, section: 'frutas', list: true, shape: 'produce', kind: 'cebolla', color: '#C99A5B', accent: '#A86B2C', ink: '#4F300D' },
  { id: 'papa', name: 'Papa', detail: '2 kg', price: 1.70, section: 'frutas', list: true, shape: 'produce', kind: 'papa', color: '#B08550', accent: '#8A6232', ink: '#3E2A10' },
  { id: 'platano', name: 'Plátano', detail: 'Racimo 1 kg', price: 1.20, section: 'frutas', list: true, shape: 'banana', color: '#F2D13A', accent: '#C9A400', ink: '#5A4700' },
  { id: 'frutas', name: 'Frutas de temporada', listName: 'Frutas', detail: 'Surtido 1 kg', price: 2.85, section: 'frutas', list: true, shape: 'produce', kind: 'frutas', color: '#F28C1C', accent: '#E06A00', ink: '#5A2A00' },
];

// Orden de la lista "COMPRAS DE LA SEMANA".
export const LIST = ['arroz', 'frijoles', 'aceite', 'azucar', 'leche', 'huevos', 'pan', 'pollo', 'queso', 'tomate', 'cebolla', 'papa', 'platano', 'frutas'];

export const productById = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
export const LIST_TOTAL = LIST.reduce((s, id) => s + productById[id].price, 0);
