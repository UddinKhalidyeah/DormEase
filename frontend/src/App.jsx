import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const defaultRooms = [
  { id: 101, type: "Shared", capacity: 4, price: 2500, beds: 2 },
  { id: 102, type: "Private", capacity: 1, price: 4000, beds: 1 },
  { id: 103, type: "Shared", capacity: 4, price: 2500, beds: 0 },
  { id: 104, type: "Suite", capacity: 2, price: 5000, beds: 1 },
  { id: 105, type: "Private", capacity: 1, price: 4000, beds: 1 },
  { id: 106, type: "Shared", capacity: 3, price: 2200, beds: 2 },
];

function loadData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [page, setPage] = useState("Overview");
  const [role, setRole] = useState("Student");

  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState("");

  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState("");

  
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [billsError, setBillsError] = useState("");


  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [message, setMessage] = useState("");

  const [selectedBill, setSelectedBill] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");

  const [form, setForm] = useState({
  name: "",
  studentId: "",
  phone: "",
});

  async function handlePayBill(event) {
  event.preventDefault();

  if (!selectedBill) return;

  const amount = Number(paymentAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    setPaymentMessage("Enter a valid payment amount.");
    return;
  }

  try {
    setPaymentLoading(true);
    setPaymentMessage("");

    const response = await axios.post(
      "http://localhost:3000/api/payments",
      {
        bill_id: Number(selectedBill.id),
        amount,
        payment_method: paymentMethod,
      }
    );

    setPaymentMessage(response.data.message);

    // Reload bills from the database.
    const billsResponse = await axios.get(
      "http://localhost:3000/api/bills"
    );

    const updatedBills = (billsResponse.data.bills || []).map(
      (bill) => ({
        id: bill.id,
        student: bill.first_name
          ? `${bill.first_name} ${bill.last_name}`
          : bill.student_name || "Unknown Student",
        studentId: bill.student_number || "",
        roomId: Number(bill.room_number) || 0,
        amount: Number(bill.amount_due ?? bill.amount),
        status: bill.status,
      })
    );

    setBills(updatedBills);
    setSelectedBill(null);
    setPaymentAmount("");
  } catch (error) {
    setPaymentMessage(
      error.response?.data?.message ||
        "Payment failed. Please try again."
    );
  } finally {
    setPaymentLoading(false);
  }
}
  
useEffect(() => {
  async function fetchApplications() {
    try {
      setApplicationsLoading(true);
      setApplicationsError("");

      const response = await axios.get(
        "http://localhost:3000/api/allocations"
      );

      const formattedApplications = response.data.allocations.map(
        (allocation) => ({
          id: allocation.allocation_id,
          name: `${allocation.first_name} ${allocation.last_name}`,
          studentId: allocation.student_number,
          roomId: Number(allocation.room_number),
          price: Number(allocation.monthly_rate),
          date: allocation.move_in_date || "",
          status: allocation.status,
        })
      );

      setApplications(formattedApplications);
    } catch (error) {
      console.error("Failed to load applications:", error);
      setApplicationsError(
        "Could not load applications. Please check the backend."
      );
    } finally {
      setApplicationsLoading(false);
    }
  }

  fetchApplications();
}, []);


  useEffect(() => {
    async function fetchRooms() {
      try {
        setRoomsLoading(true);
        setRoomsError("");

        const response = await axios.get(
          "http://localhost:3000/api/rooms"
        );

        const formattedRooms = response.data.rooms.map((room) => ({
          id: Number(room.room_number),
          dbId: room.id,
          type: "Standard",
          capacity: Number(room.capacity),
          price: Number(room.monthly_rate),
          beds:
            room.status.toLowerCase() === "available"
              ? Number(room.capacity)
              : 0,
        }));

        setRooms(formattedRooms);
      } catch (error) {
        console.error("Failed to load rooms:", error);
        setRoomsError(
          "Could not load rooms. Please check the backend."
        );
      } finally {
        setRoomsLoading(false);
      }
    }

    fetchRooms();
  }, []);

  
useEffect(() => {
  async function fetchBills() {
    try {
      setBillsLoading(true);
      setBillsError("");

      const response = await axios.get(
        "http://localhost:3000/api/bills"
      );

      const formattedBills = response.data.bills.map((bill) => ({
        id: bill.id,
        student: bill.first_name
          ? `${bill.first_name} ${bill.last_name}`
          : bill.student_name || "Unknown Student",
        studentId: bill.student_number || "",
        roomId: Number(bill.room_number) || 0,
        amount: Number(bill.amount_due ?? bill.amount ?? 0),
        status: bill.status,
      }));

      setBills(formattedBills);
    } catch (error) {
      console.error("Failed to load bills:", error);
      setBillsError("Could not load bills from the database.");
    } finally {
      setBillsLoading(false);
    }
  }

  fetchBills();
}, []);


  function notify(text) {
    setMessage(text);
  }

  async function submitApplication(event) {
  event.preventDefault();

  if (!selectedRoom) {
    notify("Please select a room first.");
    return;
  }

  const nameParts = form.name.trim().split(/\s+/);

  if (
    nameParts.length < 2 ||
    !form.studentId.trim() ||
    !form.phone.trim()
  ) {
    notify("Please enter your full name, student ID, and phone.");
    return;
  }

  try {
    // Step 1: Register the student in PostgreSQL
    const studentResponse = await axios.post(
      "http://localhost:3000/api/students",
      {
        student_number: form.studentId.trim(),
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(" "),
        phone: form.phone.trim(),
      }
    );

    const studentId = studentResponse.data.student.id;

    // Step 2: Create the room allocation
    const allocationResponse = await axios.post(
      "http://localhost:3000/api/allocations",
      {
        student_id: studentId,
        room_id: selectedRoom.dbId,
      }
    );

    // Step 3: Update the frontend after success
    const application = {
      id: allocationResponse.data.allocation.id,
      studentDbId: studentId,
      ...form,
      roomId: selectedRoom.id,
      price: selectedRoom.price,
      date: new Date().toLocaleDateString(),
      status: "Active",
    };

    setApplications((previous) => [
      application,
      ...previous,
    ]);

    setSelectedRoom(null);
    setForm({ name: "", studentId: "", phone: "" });
    setPage("Applications");
    notify("Room application submitted successfully!");
  } catch (error) {
    console.error("Application submission failed:", error);

    notify(
      error.response?.data?.message ||
      "Could not submit application. Please check your backend."
    );
  }
}

  

async function updateStatus(application, status) {
  const action = status.toLowerCase();

  if (!["approved", "rejected"].includes(action)) {
    notify("Invalid application status.");
    return;
  }

  try {
    const endpoint =
      action === "approved" ? "approve" : "reject";

    const response = await axios.patch(
      `http://localhost:3000/api/allocations/${application.id}/${endpoint}`
    );

    const savedStatus = response.data.allocation.status;

    setApplications((previous) =>
      previous.map((item) =>
        item.id === application.id
          ? { ...item, status: savedStatus }
          : item
      )
    );

    if (action === "approved") {
      // Refresh rooms from the backend.
      const roomsResponse = await axios.get(
        "http://localhost:3000/api/rooms"
      );

      const formattedRooms = roomsResponse.data.rooms.map(
        (room) => ({
          id: Number(room.room_number),
          dbId: room.id,
          type: "Standard",
          capacity: Number(room.capacity),
          price: Number(room.monthly_rate),
          beds:
            room.status.toLowerCase() === "available"
              ? Number(room.capacity)
              : 0,
        })
      );

      setRooms(formattedRooms);

      // Get the database student ID and allocation ID.
      const allocationId = Number(application.id);
      const studentResponse = await axios.get(
        "http://localhost:3000/api/students"
      );

      const students = studentResponse.data.students || [];
      const matchingStudent = students.find(
        (student) =>
          student.student_number === application.studentId
      );

      if (!matchingStudent) {
        notify(
          "Application approved, but the student record could not be found to create a bill."
        );
        return;
      }

      // Create a bill for the current calendar month.
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();

      const formatDate = (date) =>
        [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-");

      const periodStart = new Date(year, month, 1);
      const periodEnd = new Date(year, month + 1, 0);
      const dueDate = new Date(year, month, 10);

      await axios.post("http://localhost:3000/api/bills", {
        student_id: matchingStudent.id,
        allocation_id: allocationId,
        billing_period_start: formatDate(periodStart),
        billing_period_end: formatDate(periodEnd),
        due_date: formatDate(dueDate),
      });

      // Reload bills from PostgreSQL.
      const billsResponse = await axios.get(
        "http://localhost:3000/api/bills"
      );

      const formattedBills = billsResponse.data.bills.map(
        (bill) => ({
          id: bill.id,
          student: bill.first_name
            ? `${bill.first_name} ${bill.last_name}`
            : bill.student_name || "Unknown Student",
          studentId: bill.student_number || "",
          roomId: Number(bill.room_number) || 0,
          amount: Number(bill.amount_due ?? bill.amount),
          status: bill.status,
        })
      );

      setBills(formattedBills);
    }

    notify(
      action === "approved"
        ? "Application approved and bill created!"
        : "Application rejected successfully!"
    );
  } catch (error) {
    console.error("Failed to update application:", error);

    notify(
      error.response?.data?.message ||
        "Could not complete the action. Please check the backend."
    );
  }
}

return (
  <div className="app">
    <aside className="sidebar">
      <h2>DormEase</h2>
      <p>Dormitory Management</p>

      <label className="role-label">Your role</label>
      <select
        value={role}
        onChange={(event) => setRole(event.target.value)}
      >
        <option value="Student">Student</option>
        <option value="Admin">Admin</option>
      </select>

      <nav>
        {["Overview", "Rooms", "Applications", "Bills"].map((item) => (
          <button
            key={item}
            className={page === item ? "active" : ""}
            onClick={() => setPage(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <small>DormEase</small>
        <span>Room Allocation & Billing</span>
      </div>
    </aside>

    <main className="main">
      <header className="header">
        <div>
          <h3>{page}</h3>
          <span>Dormitory Room Allocation and Billing System</span>
        </div>
        <span className="user-badge">{role}</span>
      </header>

      <section className="content">
        {message && (
          <div className="message">
            {message}
            <button onClick={() => setMessage("")}>×</button>
          </div>
        )}

        {page === "Overview" && (
          <>
            <div className="welcome">
              <div>
                <h1>Welcome to DormEase</h1>
                <p>Manage your dormitory in one place.</p>
              </div>
            </div>

            <div className="stats">
              <Stat title="Total Rooms" value={rooms.length} icon="🏠" />
              <Stat
                title="Available Rooms"
                value={rooms.filter((room) => room.beds > 0).length}
                icon="🛏️"
              />
              <Stat
                title="Applications"
                value={applications.length}
                icon="📋"
              />
              <Stat title="Bills" value={bills.length} icon="💳" />
            </div>

            <div className="panel">
              <h2>Quick Actions</h2>
              <div className="quick-actions">
                {["Rooms", "Applications", "Bills"].map((item) => (
                  <button key={item} onClick={() => setPage(item)}>
                    Open {item} →
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        
        {page === "Rooms" && (
          <div className="panel">
            <h2>Available Rooms</h2>

            {roomsLoading ? (
              <p>Loading rooms...</p>
            ) : roomsError ? (
              <p>{roomsError}</p>
            ) : rooms.length === 0 ? (
              <p className="empty">No rooms found.</p>
            ) : (
              <div className="room-grid">
                {rooms.map((room) => (
                  <div
                    className="room-card"
                    key={room.dbId}
                    onClick={() => {
                      if (room.beds > 0) {
                        setSelectedRoom(room);
                        notify(`Room ${room.id} selected.`);
                      }
                    }}
                    style={{
                      cursor: room.beds > 0 ? "pointer" : "not-allowed",
                      border:
                        selectedRoom?.dbId === room.dbId
                          ? "2px solid #2563eb"
                          : undefined,
                    }}
                  >
                    <div className="room-picture">🛏️</div>
                    <div className="room-info">
                      <div className="room-heading">
                        <h3>Room {room.id}</h3>
                        <Status
                          value={room.beds > 0 ? "Available" : "Full"}
                        />
                      </div>
                      <p>Capacity: {room.capacity}</p>
                      <p className="price">
                        ₱{room.price.toLocaleString()}
                        <small> / month</small>
                      </p>
                      {selectedRoom?.dbId === room.dbId && (
                        <strong>Selected room</strong>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <hr />

            <h2>Apply for a Room</h2>
            <p>
              Select an available room above, then enter your student details.
            </p>

            <form onSubmit={submitApplication}>
              <label>
                Full Name
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Enter your full name"
                  required
                />
              </label>

              <label>
                Student ID
                <input
                  type="text"
                  value={form.studentId}
                  onChange={(event) =>
                    setForm({ ...form, studentId: event.target.value })
                  }
                  placeholder="Enter your student ID"
                  required
                />
              </label>

              <label>
                Phone Number
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="Enter your phone number"
                  required
                />
              </label>

              <button
                type="submit"
                className="primary"
                disabled={!selectedRoom}
              >
                Apply for Room
              </button>
            </form>
          </div>
        )}

        {page === "Applications" && (
          <div className="panel">
            <h2>Student Applications</h2>
            {applicationsLoading ? (
              <p>Loading applications...</p>
            ) : applicationsError ? (
              <p>{applicationsError}</p>
            ) : applications.length === 0 ? (
              <p className="empty">No applications found.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Student ID</th>
                      <th>Room</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application.id}>
                        <td>{application.name}</td>
                        <td>{application.studentId}</td>
                        <td>{application.roomId}</td>
                        <td><Status value={application.status} /></td>
                        <td>
                          {role === "Admin" &&
                          !["approved", "rejected"].includes(
                            String(application.status).toLowerCase()
                          ) ? (
                            <div className="actions">
                              <button
                                className="approve"
                                onClick={() =>
                                  updateStatus(application, "approved")
                                }
                              >
                                Approve
                              </button>
                              <button
                                className="reject"
                                onClick={() =>
                                  updateStatus(application, "rejected")
                                }
                              >
                                Reject
                              </button>
                            </div>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {page === "Bills" && (
          <div className="panel">
            <h2>Bills & Payments</h2>
            {billsLoading ? (
              <p>Loading bills...</p>
            ) : billsError ? (
              <p>{billsError}</p>
            ) : bills.length === 0 ? (
              <p className="empty">No bills found.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Student ID</th>
                      <th>Room</th>
                      <th>Amount Due</th>
                      <th>Status</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill) => (
                      <tr key={bill.id}>
                        <td>{bill.student}</td>
                        <td>{bill.studentId}</td>
                        <td>{bill.roomId}</td>
                        <td>₱{bill.amount.toLocaleString()}</td>
                        <td><Status value={bill.status} /></td>
                        <td>
                          <button
                            className="primary"
                            onClick={() => {
                              setSelectedBill(bill);
                              setPaymentAmount("");
                              setPaymentMessage("");
                            }}
                          >
                            Pay
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {selectedBill && (
          <div className="modal-bg">
            <form className="modal" onSubmit={handlePayBill}>
              <button
                type="button"
                className="close"
                onClick={() => setSelectedBill(null)}
              >
                ×
              </button>
              <h2>Record Payment</h2>
              <p>Bill for {selectedBill.student}</p>

              <label>
                Payment Amount (₱)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) =>
                    setPaymentAmount(event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Payment Method
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="e_wallet">E-wallet</option>
                </select>
              </label>

              {paymentMessage && <p>{paymentMessage}</p>}

              <button
                className="primary full"
                type="submit"
                disabled={paymentLoading}
              >
                {paymentLoading ? "Processing..." : "Submit Payment"}
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  </div>
);

}

function Stat({ title, value, icon }) {
  return (
    <div className="stat">
      <span>{icon}</span>
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  );
}


function Status({ value }) {
  const className =
    value === "Approved" ||
    value === "Paid" ||
    value === "Available"
      ? "green-status"
      : value === "Rejected" || value === "Full"
      ? "red-status"
      : "yellow-status";

  return <span className={`status ${className}`}>{value}</span>;
}

export default App;