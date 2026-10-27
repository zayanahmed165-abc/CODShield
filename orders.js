import { db } from "hatchable";

export const access = "user";
export const methods = ["GET", "POST", "PUT"];

const allowedStatuses = new Set(["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"]);
const clean = (value, max) => String(value ?? "").trim().slice(0, max);
function validDate(value) {
  if (!value) return null;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s + "T00:00:00Z"))) return undefined;
  return s;
}
function publicOrder(row) {
  return {
    id: row.id, order_code: row.order_code, customer_name: row.customer_name,
    phone: row.phone, address: row.address, amount: Number(row.amount),
    status: row.status, follow_up_date: row.follow_up_date ? String(row.follow_up_date).slice(0, 10) : "",
    notes: row.notes, created_at: row.created_at, updated_at: row.updated_at
  };
}
export default async function(req, res) {
  try {
    if (req.method === "GET") {
      const { rows } = await db.query(
        "SELECT id, order_code, customer_name, phone, address, amount, status, follow_up_date, notes, created_at, updated_at FROM cod_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500",
        [req.user.id]
      );
      return res.json({ orders: rows.map(publicOrder) });
    }
    const body = req.body || {};
    if (req.method === "POST") {
      const customer_name = clean(body.customer_name, 100);
      const phone = clean(body.phone, 30);
      const address = clean(body.address, 300);
      const notes = clean(body.notes, 500);
      const amount = Number(body.amount);
      const status = clean(body.status || "Pending", 20);
      const follow_up_date = validDate(body.follow_up_date);
      if (!customer_name || !phone || !Number.isFinite(amount) || amount <= 0 || amount > 100000000)
        return res.status(400).json({ error: "Enter a customer name, phone number, and valid positive amount." });
      if (!allowedStatuses.has(status)) return res.status(400).json({ error: "Invalid order status." });
      if (follow_up_date === undefined) return res.status(400).json({ error: "Follow-up date is invalid." });
      let requestedCode = clean(body.order_code, 60);
      if (!requestedCode) requestedCode = "COD-" + crypto.randomUUID().slice(0, 8).toUpperCase();
      const { rows } = await db.query(
        "INSERT INTO cod_orders (user_id, order_code, customer_name, phone, address, amount, status, follow_up_date, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, order_code, customer_name, phone, address, amount, status, follow_up_date, notes, created_at, updated_at",
        [req.user.id, requestedCode, customer_name, phone, address, amount, status, follow_up_date, notes]
      );
      return res.status(201).json({ order: publicOrder(rows[0]) });
    }
    if (req.method === "PUT") {
      const id = clean(body.id, 50);
      const status = clean(body.status, 20);
      if (!id || !allowedStatuses.has(status)) return res.status(400).json({ error: "Choose a valid order and status." });
      const { rows } = await db.query(
        "UPDATE cod_orders SET status=$2, updated_at=NOW() WHERE id=$1 AND user_id=$3 RETURNING id, order_code, customer_name, phone, address, amount, status, follow_up_date, notes, created_at, updated_at",
        [id, status, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: "Order not found." });
      return res.json({ order: publicOrder(rows[0]) });
    }
    return res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    if (error && error.code === "23505") return res.status(409).json({ error: "That order ID already exists. Use a different ID." });
    console.error("CODShield orders endpoint failed", error);
    return res.status(500).json({ error: "The order could not be saved right now. Please try again." });
  }
}