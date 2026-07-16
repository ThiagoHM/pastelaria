import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { hash } from "bcryptjs";
import {
  Ingredient,
  Notification,
  Order,
  OrderItem,
  OrderStatusHistory,
  Product,
  ProductCategory,
  User,
  UserRole,
} from "./entities";
const ds = new DataSource({
  type: "postgres",
  url:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5433/pastelaria_recanto",
  entities: [
    User,
    Product,
    Ingredient,
    Order,
    OrderItem,
    OrderStatusHistory,
    Notification,
  ],
  synchronize: true,
});
async function run() {
  await ds.initialize();
  const users = ds.getRepository(User),
    products = ds.getRepository(Product),
    ingredients = ds.getRepository(Ingredient);
  if (!(await users.findOneBy({ email: "admin@recanto.com" })))
    await users.save(
      users.create({
        email: "admin@recanto.com",
        fullName: "Administrador Recanto",
        passwordHash: await hash("Recanto@123", 12),
        role: UserRole.ADMIN,
        cep: "00000-000",
        street: "Pastelaria Recanto",
        number: "S/N",
      }),
    );
  if ((await products.count()) === 0)
    await products.save(
      [
        {
          name: "Pastel da Casa",
          description: "Carne, queijo, tomate e tempero da casa",
          price: 18.9,
          category: ProductCategory.PASTEL,
        },
        {
          name: "Frango Cremoso",
          description: "Frango desfiado, catupiry e milho",
          price: 17.5,
          category: ProductCategory.PASTEL,
        },
        {
          name: "Coca-Cola",
          description: "Lata 350 ml, bem gelada",
          price: 6.5,
          category: ProductCategory.DRINK,
        },
      ].map((x) => products.create(x)),
    );
  if ((await ingredients.count()) === 0)
    await ingredients.save(
      [
        "Muçarela",
        "Carne",
        "Frango",
        "Catupiry",
        "Milho",
        "Tomate",
        "Cebola",
      ].map((name, i) =>
        ingredients.create({ name, additionalPrice: i < 3 ? 3.5 : 2 }),
      ),
    );
  await ds.destroy();
  console.log("Dados iniciais criados. Admin: admin@recanto.com / Recanto@123");
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
