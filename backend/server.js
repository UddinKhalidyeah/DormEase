
  import express from "express";
  import cors from "cors";
  import dotenv from "dotenv";
  import { pool } from "./db.js";

  // Load environment variables from .env when we add that file
  dotenv.config();

  // Create our Express application
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware: process JSON requests and allow cross-origin requests
  app.use(cors());
  app.use(express.json());

  // Route 1: Welcome page for our API
  app.get("/", (req, res) => {
    res.json({
      success: true,
      message:
        "Dormitory Room Allocation and Billing System API is running!"
    });
  });

  // Route 2: Check whether our backend is working
  app.get("/api/health", (req, res) => {
    res.status(200).json({
      success: true,
      status: "OK",
      message: "Backend server is healthy"
    });
  });

  //Database Test Route: Check PostgreSQL connection
  app.get("/api/db-test", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT NOW() AS current_time, current_database() AS database_name"
      );

      res.json({
        success: true,
        message: "PostgreSQL connected successfully!",
        database: result.rows[0].database_name,
        time: result.rows[0].current_time,
      });
    } catch (error) {
      console.error("Database test failed:", error.message);

      res.status(500).json({
        success: false,
        message: "Database connection failed. Check your configuration.",
      });
    }
  });


  app.get("/api/rooms", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          room_number,
          capacity,
          monthly_rate,
          status
        FROM rooms
        ORDER BY room_number;
      `);

      res.json({
        success: true,
        count: result.rows.length,
        rooms: result.rows,
      });
    } catch (error) {
      console.error("Error fetching rooms:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve rooms.",
      });
    }
  });


  app.post("/api/rooms", async (req, res) => {
    try {
      const { room_number, capacity, monthly_rate } = req.body;

      if (
        typeof room_number !== "string" ||
        !room_number.trim() ||
        !Number.isInteger(capacity) ||
        capacity <= 0 ||
        monthly_rate === undefined ||
        monthly_rate === null ||
        monthly_rate === "" ||
        !Number.isFinite(Number(monthly_rate)) ||
        Number(monthly_rate) < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Provide a room number, positive capacity, and valid monthly rate.",
        });
      }

      const result = await pool.query(
        `INSERT INTO rooms (room_number, capacity, monthly_rate)
        VALUES ($1, $2, $3)
        RETURNING id, room_number, capacity, monthly_rate, status`,
        [room_number.trim(), capacity, Number(monthly_rate)]
      );

      res.status(201).json({
        success: true,
        message: "Room added successfully!",
        room: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "That room number already exists.",
        });
      }

      console.error("Error adding room:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to add room.",
      });
    }
  });

  app.get("/api/allocations", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        a.id AS allocation_id,
        s.first_name,
        s.last_name,
        s.student_number,
        r.room_number,
        r.monthly_rate,
        a.move_in_date,
        a.status
      FROM allocations a
      JOIN students s ON a.student_id = s.id
      JOIN rooms r ON a.room_id = r.id
      ORDER BY a.id DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      allocations: result.rows,
    });
  } catch (error) {
    console.error("Failed to retrieve allocations:", error);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve allocations",
    });
  }
});

  app.post("/api/students", async (req, res) => {
    try {
      const {
        student_number,
        first_name,
        last_name,
        email,
        phone,
      } = req.body;

      // Check required fields
      if (
        typeof student_number !== "string" ||
        !student_number.trim() ||
        typeof first_name !== "string" ||
        !first_name.trim() ||
        typeof last_name !== "string" ||
        !last_name.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Student number, first name, and last name are required.",
        });
      }

      // Save the student in PostgreSQL
      const result = await pool.query(
        `INSERT INTO students
          (student_number, first_name, last_name, email, phone)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, student_number, first_name, last_name, email, phone`,
        [
          student_number.trim(),
          first_name.trim(),
          last_name.trim(),
          email || null,
          phone || null,
        ]
      );

      res.status(201).json({
        success: true,
        message: "Student registered successfully!",
        student: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message:
            "That student number or email already exists.",
        });
      }

      console.error("Error registering student:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to register student.",
      });
    }
  });


  app.get("/api/students", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          student_number,
          first_name,
          last_name,
          email,
          phone,
          created_at
        FROM students
        ORDER BY id;
      `);

      res.json({
        success: true,
        count: result.rows.length,
        students: result.rows,
      });
    } catch (error) {
      console.error("Error fetching students:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve students.",
      });
    }
  });


  
app.post("/api/allocations", async (req, res) => {
  const { student_id, room_id } = req.body;

  if (
    !Number.isInteger(student_id) ||
    student_id <= 0 ||
    !Number.isInteger(room_id) ||
    room_id <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid student_id and room_id are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roomResult = await client.query(
      `SELECT id, capacity, status
       FROM rooms
       WHERE id = $1
       FOR UPDATE`,
      [room_id]
    );

    if (roomResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    if (roomResult.rows[0].status !== "available") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This room is not available for applications.",
      });
    }

    const studentResult = await client.query(
      "SELECT id FROM students WHERE id = $1",
      [student_id]
    );

    if (studentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    // Prevent duplicate pending applications or active allocations.
    const existingResult = await client.query(
      `SELECT id
       FROM allocations
       WHERE student_id = $1
         AND status IN ('pending', 'active')
       LIMIT 1`,
      [student_id]
    );

    if (existingResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message:
          "This student already has a pending application or active allocation.",
      });
    }

    // Check current occupancy before accepting the application.
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS occupied
       FROM allocations
       WHERE room_id = $1 AND status = 'active'`,
      [room_id]
    );

    if (
      countResult.rows[0].occupied >=
      roomResult.rows[0].capacity
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This room has reached its capacity.",
      });
    }

    const allocationResult = await client.query(
      `INSERT INTO allocations (student_id, room_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING id, student_id, room_id, move_in_date, status`,
      [student_id, room_id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Room application submitted for approval.",
      allocation: allocationResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("Error submitting room application:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to submit room application.",
    });
  } finally {
    client.release();
  }
});



  
app.patch("/api/allocations/:id/approve", async (req, res) => {
  const allocationId = Number(req.params.id);

  if (!Number.isInteger(allocationId) || allocationId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid allocation ID.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the pending application.
    const allocationResult = await client.query(
      `SELECT id, student_id, room_id
       FROM allocations
       WHERE id = $1 AND status = 'pending'
       FOR UPDATE`,
      [allocationId]
    );

    if (allocationResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Pending application not found.",
      });
    }

    const allocation = allocationResult.rows[0];

    // Lock the room before checking capacity.
    const roomResult = await client.query(
      `SELECT id, capacity, status
       FROM rooms
       WHERE id = $1
       FOR UPDATE`,
      [allocation.room_id]
    );

    if (
      roomResult.rowCount === 0 ||
      roomResult.rows[0].status !== "available"
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This room is not available.",
      });
    }

    // Prevent a student from having multiple active allocations.
    const studentAllocationResult = await client.query(
      `SELECT id
       FROM allocations
       WHERE student_id = $1
         AND status = 'active'
       LIMIT 1`,
      [allocation.student_id]
    );

    if (studentAllocationResult.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This student already has an active allocation.",
      });
    }

    const occupancyResult = await client.query(
      `SELECT COUNT(*)::int AS occupied
       FROM allocations
       WHERE room_id = $1 AND status = 'active'`,
      [allocation.room_id]
    );

    if (
      occupancyResult.rows[0].occupied >=
      roomResult.rows[0].capacity
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This room has reached its capacity.",
      });
    }

    const updatedResult = await client.query(
      `UPDATE allocations
       SET status = 'active'
       WHERE id = $1
       RETURNING id, student_id, room_id, status`,
      [allocationId]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Application approved successfully.",
      allocation: updatedResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Approval error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to approve application.",
    });
  } finally {
    client.release();
  }
});


app.patch("/api/allocations/:id/reject", async (req, res) => {
  const allocationId = Number(req.params.id);

  if (!Number.isInteger(allocationId) || allocationId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid allocation ID.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE allocations
       SET status = 'rejected'
       WHERE id = $1 AND status = 'pending'
       RETURNING id, student_id, room_id, status`,
      [allocationId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending application not found.",
      });
    }

    return res.json({
      success: true,
      message: "Application rejected successfully.",
      allocation: result.rows[0],
    });
  } catch (error) {
    console.error("Rejection error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to reject application.",
    });
  }
});

  app.post("/api/bills", async (req, res) => {
    const {
      student_id,
      allocation_id,
      billing_period_start,
      billing_period_end,
      due_date,
    } = req.body;

    if (
      !Number.isInteger(student_id) ||
      student_id <= 0 ||
      !Number.isInteger(allocation_id) ||
      allocation_id <= 0 ||
      !billing_period_start ||
      !billing_period_end ||
      !due_date
    ) {
      return res.status(400).json({
        success: false,
        message: "All bill fields are required.",
      });
    }

    // Require dates in YYYY-MM-DD format.
    const isDate = (value) =>
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value;

    if (
      !isDate(billing_period_start) ||
      !isDate(billing_period_end) ||
      !isDate(due_date) ||
      billing_period_end < billing_period_start
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide valid dates and a valid billing period.",
      });
    }

    try {
      // Confirm the allocation belongs to this student and is active.
      const allocationResult = await pool.query(
        `SELECT a.id, a.student_id, r.monthly_rate
        FROM allocations a
        JOIN rooms r ON r.id = a.room_id
        WHERE a.id = $1
          AND a.student_id = $2
          AND a.status = 'active'`,
        [allocation_id, student_id]
      );

      if (allocationResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Active allocation not found for this student.",
        });
      }

      const monthlyRate = Number(
        allocationResult.rows[0].monthly_rate
      );

      const result = await pool.query(
        `INSERT INTO bills (
          student_id,
          allocation_id,
          billing_period_start,
          billing_period_end,
          amount_due,
          due_date
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          student_id,
          allocation_id,
          billing_period_start,
          billing_period_end,
          monthlyRate,
          due_date,
        ]
      );

      res.status(201).json({
        success: true,
        message: "Bill created successfully!",
        bill: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "A bill already exists for this allocation and period.",
        });
      }

      console.error("Error creating bill:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to create bill.",
      });
    }
  });




  app.get("/api/bills", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          b.id AS bill_id,
          s.student_number,
          s.first_name,
          s.last_name,
          r.room_number,
          TO_CHAR(b.billing_period_start, 'YYYY-MM-DD') AS billing_period_start,
          TO_CHAR(b.billing_period_end, 'YYYY-MM-DD') AS billing_period_end,
          TO_CHAR(b.due_date, 'YYYY-MM-DD') AS due_date,
          b.amount_due,
          b.status,
          COALESCE(SUM(p.amount), 0) AS amount_paid,
          b.amount_due - COALESCE(SUM(p.amount), 0) AS balance
        FROM bills b
        JOIN students s ON b.student_id = s.id
        JOIN allocations a ON b.allocation_id = a.id
        JOIN rooms r ON a.room_id = r.id
        LEFT JOIN payments p ON p.bill_id = b.id
        GROUP BY
          b.id,
          s.student_number,
          s.first_name,
          s.last_name,
          r.room_number
        ORDER BY b.due_date, b.id;
      `);

      res.json({
        success: true,
        count: result.rows.length,
        bills: result.rows
      });
    } catch (error) {
      console.error("Error fetching bills:", error.message);
      res.status(500).json({
        success: false,
        message: "Unable to retrieve bills."
      });
    }
  });



  app.post("/api/payments", async (req, res) => {
    const { bill_id, amount, payment_method, reference_number, notes } =
      req.body;

    if (
      !Number.isInteger(bill_id) ||
      bill_id <= 0 ||
      amount === undefined ||
      amount === null ||
      amount === "" ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0 ||
      !["cash", "bank_transfer", "card", "e_wallet"].includes(payment_method)
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid bill, positive payment amount, and payment method.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const billResult = await client.query(
        `SELECT id, amount_due, status
        FROM bills
        WHERE id = $1
        FOR UPDATE`,
        [bill_id]
      );

      if (billResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Bill not found.",
        });
      }

      const bill = billResult.rows[0];

      if (bill.status === "void") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "Cannot pay a void bill.",
        });
      }

      const paidResult = await client.query(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE bill_id = $1",
        [bill_id]
      );

      const amountDue = Number(bill.amount_due);
      const amountPaid = Number(paidResult.rows[0].total);
      const paymentAmount = Number(amount);

      if (paymentAmount > amountDue - amountPaid + 0.000001) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Payment exceeds the outstanding balance.",
          balance: Math.max(0, amountDue - amountPaid).toFixed(2),
        });
      }

      const paymentResult = await client.query(
        `INSERT INTO payments
          (bill_id, amount, payment_method, reference_number, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          bill_id,
          paymentAmount,
          payment_method,
          reference_number || null,
          notes || null,
        ]
      );

      const newTotalPaid = amountPaid + paymentAmount;
      const newStatus =
        newTotalPaid >= amountDue - 0.000001 ? "paid" : "partially_paid";

      await client.query(
        "UPDATE bills SET status = $1 WHERE id = $2",
        [newStatus, bill_id]
      );

      await client.query("COMMIT");

      res.status(201).json({
        success: true,
        message: "Payment recorded successfully!",
        payment: paymentResult.rows[0],
        amount_paid: newTotalPaid.toFixed(2),
        balance: Math.max(0, amountDue - newTotalPaid).toFixed(2),
        bill_status: newStatus,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});

      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "That payment reference number already exists.",
        });
      }

      console.error("Error recording payment:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to record payment.",
      });
    } finally {
      client.release();
    }
  });


  app.get("/api/payments", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          p.id AS payment_id,
          p.bill_id,
          s.student_number,
          s.first_name,
          s.last_name,
          p.amount,
          p.payment_method,
          p.reference_number,
          p.payment_date,
          p.notes
        FROM payments p
        JOIN bills b ON b.id = p.bill_id
        JOIN students s ON s.id = b.student_id
        ORDER BY p.payment_date DESC, p.id DESC;
      `);

      res.json({
        success: true,
        count: result.rows.length,
        payments: result.rows,
      });
    } catch (error) {
      console.error("Error fetching payments:", error.message);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve payment history.",
      });
    }
  });


  // Start server
  app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
  });
