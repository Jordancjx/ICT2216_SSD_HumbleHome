import { useEffect, useState } from "react";
import ProductCard from "../components/ProductCard";
import STLViewer from "../STLViewer";

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch("/api/products/active");
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };

    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories");
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchProducts();
    fetchCategories();
  }, []);

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category === selectedCategory)
    : products;

  return (
    <main className="w-full pb-10 flex flex-col items-center">
      {/* Banner */}
      <div
        id="banner"
        className="relative w-full bg-gray-200 flex flex-col md:flex-row items-center justify-center text-center h-auto md:h-96"
      >
        <div className="w-full md:w-5/6 h-full px-3 flex flex-col md:flex-row">
          <div className="w-full md:w-1/2 flex items-center justify-center mb-6 md:mb-0">
            <div className="max-w-md text-left">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold">
                Live Better with Every Piece
              </h1>
              <h2 className="mt-5 text-md sm:text-lg md:text-md">
                Furniture that fits your life. Thoughtfully designed,
                beautifully crafted.
              </h2>
            </div>
          </div>
          <div className="w-full md:w-1/2 flex justify-center items-center">
            <STLViewer url={`/api/uploads/models/AlchemyTable.stl`} />
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="w-full py-10 flex flex-col items-center">
        <div className="w-5/6 px-8 py-4 flex justify-between">
          <h1 className="text-2xl font-bold">Our Products</h1>
        </div>
        <div className="w-5/6 px-4 md:px-8 py-4 flex flex-col md:flex-row">
          {/* Sidebar */}
          <aside className="w-full md:w-1/4 mb-6 md:mb-0 pr-0 md:pr-8">
            <div className="max-w-sm rounded bg-white overflow-hidden shadow-lg mx-auto md:mx-0">
              <div className="px-6 py-4">
                <h2 className="font-bold text-md mb-2">Categories</h2>
                <div className="flex flex-wrap md:flex-col gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.id || category.name}
                      onClick={() => setSelectedCategory(category.name)}
                      className={`text-center md:text-left py-2 px-4 rounded shadow w-full md:w-auto ${
                        selectedCategory === category.name
                          ? "bg-accent font-bold text-page"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <section className="w-full md:w-3/4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={{ ...product, id: product.id }}
              />
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
