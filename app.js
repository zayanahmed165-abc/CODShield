
const SUPABASE_URL = "https://tpvoqfurhqacdcvjnxjv.supabase.co";
const KEY = "sb_publishable_4JCkMsGZ8bXXYPI1vwj8nw_7MIPVAPE";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let sb, user, orders = [], view = "overview", toastTimer;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

const money = n => "₨" + Number(n || 0).toLocaleString("en-PK", {
  maximumFractionDigits: 0
});

const initials = s => String(s || "?")
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map(x => x[0] || "")
  .join("")
  .toUpperCase();

const dateLabel = d => d
  ? new Date(d.length === 10 ? d + "T00:00:00" : d)
      .toLocaleDateString("en-PK", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      })
  : "—";

function toast(message, err = false) {
  const t = $("#toast");
  if (!t) {
    console.log(message);
    return;
  }

  t.textContent = message;
  t.classList.toggle("error", err);
  t.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3500);
}

function setView(v) {
  view = v;

  $$(".nav-item").forEach(b => {
    b.classList.toggle("active", b.dataset.view === v);
  });

  const labels = {
    overview: [
      "Overview",
      "Good evening.",
      "A clearer view of your COD orders, confirmations, and delivery outcomes."
    ],
    orders: [
      "Orders",
      "Your orders, in one place.",
      "Review and update every COD order recorded for your store."
    ],
    followups: [
      "Follow-up queue",
      "Keep every order moving.",
      "Prioritize pending confirmations and upcoming follow-ups."
    ],
    analytics: [
      "Delivery insights",
      "Know what is happening in your store.",
      "Review your recorded order statuses and COD value."
    ]
  };

  const [crumb, title, subtitle] = labels[v] || labels.overview;

  $("#crumb").textContent = crumb;
  $("#pageTitle").innerHTML = v === "overview"
    ? "Good evening. <em>Let's protect your profit.</em>"
    : esc(title);

  $("#pageSubtitle").textContent = subtitle;
  $("#tableTitle").textContent =
    v === "followups" ? "Orders needing follow-up" :
    v === "analytics" ? "Order activity" :
    "Recent orders";

  render();
}

function render() {
  const total = orders.length;

  const pending = orders.filter(o => o.status === "Pending").length;

  const confirmed = orders.filter(o =>
    ["Confirmed", "Shipped", "Delivered"].includes(o.status)
  ).length;

  const value = orders
    .filter(o => o.status !== "Cancelled")
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);

  $("#metricTotal").textContent = total;
  $("#metricPending").textContent = pending;
  $("#metricConfirmed").textContent = confirmed;
  $("#metricValue").textContent = money(value);

  $("#navOrders").textContent = total;
  $("#queueBadge").textContent = pending;

  renderTable();
  renderQueue();
}

function renderTable() {
  const search = $("#searchInput").value.toLowerCase().trim();
  const status = $("#statusFilter").value;

  let list = orders.filter(o =>
    (status === "all" || o.status === status) &&
    [o.order_code, o.customer_name, o.phone].some(x =>
      String(x || "").toLowerCase().includes(search)
    )
  );

  if (view === "followups") {
    list = list.filter(o => o.status === "Pending");
  }

  list = list.slice(0, view === "overview" ? 6 : 100);

  $("#tableCount").textContent =
    `Showing ${list.length} order${list.length === 1 ? "" : "s"}`;

  if (!list.length) {
    $("#ordersBody").innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <div class="empty-icon">▤</div>
          <b>No matching orders</b>
          <p>Add an order to start your COD workflow.</p>
          <button class="text-btn" id="emptyAdd">＋ Create an order</button>
        </td>
      </tr>`;

    $("#emptyAdd")?.addEventListener("click", openModal);
    return;
  }

  $("#ordersBody").innerHTML = list.map(o => `
    <tr>
      <td>
        <div class="customer-cell">
          <div class="customer-avatar">
            ${esc(initials(o.customer_name))}
          </div>
          <div class="customer-info">
            <b>${esc(o.customer_name)}</b>
            <small>
              ${esc(o.order_code || "ORD-" + String(o.id).slice(0, 6))}
              · ${esc(o.phone)}
            </small>
          </div>
        </div>
      </td>
      <td class="amount-cell">${money(o.amount)}</td>
      <td><span class="status ${esc(o.status)}">${esc(o.status)}</span></td>
      <td>${dateLabel((o.created_at || "").slice(0, 10) || o.order_date)}</td>
      <td>
        <button class="row-menu" data-order="${esc(o.id)}"
          title="Update status">⋯</button>
      </td>
    </tr>
  `).join("");

  $$(".row-menu").forEach(button => {
    button.addEventListener("click", () => statusMenu(button.dataset.order));
  });
}

function renderQueue() {
  const pending = orders
    .filter(o => o.status === "Pending")
    .slice(0, 4);

  $("#queueList").innerHTML = pending.length
    ? pending.map(o => `
        <div class="queue-item">
          <div class="queue-initial">
            ${esc(initials(o.customer_name))}
          </div>
          <div>
            <b>${esc(o.customer_name)}</b>
            <small>${money(o.amount)} · Needs confirmation</small>
          </div>
          <button data-confirm="${esc(o.id)}">Confirm</button>
        </div>
      `).join("")
    : `
        <div class="queue-empty">
          <span>✓</span>
          <b>You're all caught up</b>
          <p>Pending orders will appear here.</p>
        </div>
      `;

  $$("[data-confirm]").forEach(button => {
    button.addEventListener("click", () =>
      updateStatus(button.dataset.confirm, "Confirmed")
    );
  });
}

function openModal() {
  const form = $("#orderForm");
  form.reset();

  $("#formError").textContent = "";
  $("#orderModal").hidden = false;
  document.body.style.overflow = "hidden";

  setTimeout(() => form.elements.customer_name.focus(), 30);
}

function closeModal() {
  $("#orderModal").hidden = true;
  document.body.style.overflow = "";
}

async function loadOrders() {
  const { data, error } = await sb
    .from("cod_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    toast("Could not load orders: " + error.message, true);
    return;
  }

  orders = data || [];
  render();
}

async function saveOrder(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = Object.fromEntries(new FormData(form).entries());

  formData.amount = Number(formData.amount);

  if (
    !formData.customer_name.trim() ||
    !formData.phone.trim() ||
    !Number.isFinite(formData.amount) ||
    formData.amount <= 0
  ) {
    $("#formError").textContent =
      "Enter a customer, phone number, and valid COD amount.";
    return;
  }

  const button = $("#saveOrder");
  button.disabled = true;
  button.textContent = "Saving…";
  $("#formError").textContent = "";

  try {
    const { data, error } = await sb
      .from("cod_orders")
      .insert({
        user_id: user.id,
        order_code: formData.order_code.trim() ||
          "ORD-" + Date.now().toString().slice(-8),
        customer_name: formData.customer_name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim() || null,
        amount: formData.amount,
        status: formData.status || "Pending",
        follow_up_date: formData.follow_up_date || null,
        notes: formData.notes.trim() || null
      })
      .select("*")
      .single();

    if (error) throw error;

    orders.unshift(data);
    closeModal();
    render();
    toast("Order saved securely to your account.");
  } catch (error) {
    $("#formError").textContent =
      error.message || "Could not save order.";
  } finally {
    button.disabled = false;
    button.innerHTML = "<span>＋</span> Save order";
  }
}

async function updateStatus(id, status) {
  const { data, error } = await sb
    .from("cod_orders")
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    toast("Could not update status: " + error.message, true);
    return;
  }

  orders = orders.map(o =>
    String(o.id) === String(id) ? data : o
  );

  render();
  toast("Order status updated to " + status + ".");
}

function statusMenu(id) {
  const order = orders.find(o => String(o.id) === String(id));
  if (!order) return;

  const answer = prompt(
    "Update status for " + order.customer_name +
    "\nType: Pending, Confirmed, Shipped, Delivered, or Cancelled",
    order.status
  );

  if (answer === null) return;

  const status = [
    "Pending",
    "Confirmed",
    "Shipped",
    "Delivered",
    "Cancelled"
  ].find(s => s.toLowerCase() === answer.trim().toLowerCase());

  if (!status) {
    toast("Invalid status.", true);
    return;
  }

  updateStatus(id, status);
}

function exportCSV() {
  if (!orders.length) {
    toast("Add an order before exporting.", true);
    return;
  }

  const columns = [
    "order_code",
    "customer_name",
    "phone",
    "address",
    "amount",
    "status",
    "follow_up_date",
    "notes",
    "created_at"
  ];

  const csv = [
    columns.join(","),
    ...orders.map(order =>
      columns.map(key =>
        '"' + String(order[key] ?? "").replace(/"/g, '""') + '"'
      ).join(",")
    )
  ].join("\r\n");

  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = "codshield-orders.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(downloadUrl);
  toast("CSV report downloaded.");
}

function loadLibrary() {
  return new Promise((resolve, reject) => {
    if (window.supabase?.createClient) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("Could not load Supabase library"));

    document.head.appendChild(script);
  });
}

async function start() {
  await loadLibrary();

  sb = window.supabase.createClient(SUPABASE_URL, KEY);

  const { data, error } = await sb.auth.getSession();

  if (error) throw error;

  if (!data.session?.user) {
    location.replace(
      "/login?next=" +
      encodeURIComponent(location.pathname + location.search)
    );
    return;
  }

  user = data.session.user;

  const signOutButton = $("#signOutBtn");

  if (signOutButton) {
    signOutButton.hidden = false;
    signOutButton.addEventListener("click", async () => {
      const { error } = await sb.auth.signOut();

      if (error) {
        toast("Could not sign out: " + error.message, true);
        return;
      }

      location.replace("/login");
    });
  }

  const accountLink = $(".login-link");

  if (accountLink) {
    accountLink.textContent = user.email || "My account";
    accountLink.href = "/login";
  }

  const bindClick = (selector, callback) => {
    $(selector)?.addEventListener("click", callback);
  };

  bindClick("#addOrderBtn", openModal);
  bindClick("#quickAdd", openModal);
  bindClick("#quickActionAdd", openModal);
  bindClick("#closeModal", closeModal);
  bindClick("#cancelModal", closeModal);

  $("#orderForm")?.addEventListener("submit", saveOrder);
  bindClick("#exportBtn", exportCSV);

  $("#searchInput")?.addEventListener("input", renderTable);
  $("#statusFilter")?.addEventListener("change", renderTable);

  bindClick("#viewAll", () => setView("orders"));

  bindClick("#dismissBanner", () => {
    $(".demo-banner")?.remove();
  });

  $$("[data-view]").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && $("#orderModal") &&
        !$("#orderModal").hidden) {
      closeModal();
    }
  });

  await loadOrders();
}

start().catch(error => {
  console.error("CODShield setup error:", error);

  const message = error.message || "Refresh and try again";

  if ($("#toast")) {
    toast("Setup problem: " + message, true);
  } else {
    alert("Setup problem: " + message);
  }
});
