// ============================
//  Twilio SMS Backend Server
// ============================

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const twilio = require("twilio");
const mongoose = require("mongoose");

// ----------------------------
//  Load .env file safely
// ----------------------------
const envPath = path.join(__dirname, ".env");

if (!fs.existsSync(envPath)) {
  console.error("ERROR: .env file not found in backend folder!");
  process.exit(1);
}

require("dotenv").config({ path: envPath });

// ----------------------------
//  Extract env variables
// ----------------------------
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, PORT, MONGO_URI } =
  process.env;

// Twilio Checks
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
  console.error("ERROR: Twilio credentials missing in .env!");
  process.exit(1);
}

// MongoDB Checks
if (!MONGO_URI) {
  console.error("ERROR: MONGO_URI missing in .env!");
  process.exit(1);
}

console.log("Twilio + MongoDB credentials loaded");

// ----------------------------
//  MongoDB Connection
// ----------------------------
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch((err) => {
    console.error("MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// ----------------------------
//  Message Schema
// ----------------------------
const MessageSchema = new mongoose.Schema(
  {
    from: String,
    to: String,
    message: String, // renamed for React table compatibility
    sid: String,
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", MessageSchema);

// ----------------------------
//  Twilio Client
// ----------------------------
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// ----------------------------
//  Express Setup
// ----------------------------
const app = express();
app.use(cors());
app.use(express.json());

// ----------------------------
//  Routes
// ----------------------------

// Test route
app.get("/", (req, res) => {
  res.send("Twilio SMS Server is running!");
});

// Send SMS + Save into MongoDB
app.post("/send-sms", async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message)
    return res.status(400).json({
      message: "Please provide 'to' and 'message' fields!",
    });

  try {
    // Send SMS from Twilio
    const sms = await client.messages.create({
      from: TWILIO_FROM,
      to,
      body: message,
    });

    // Save SMS to DB
    await Message.create({
      from: TWILIO_FROM,
      to,
      message,
      sid: sms.sid,
    });

    res.json({
      success: true,
      message: "SMS sent & saved successfully!",
      sid: sms.sid,
    });
  } catch (error) {
    console.error("SMS Error:", error.message);
    res.status(500).json({
      success: false,
      message: "SMS sending failed!",
      error: error.message,
    });
  }
});

// Fetch all messages for React Table
app.get("/all-messages", async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// ----------------------------
//  Start Server
// ----------------------------
const serverPort = PORT || 5000;
app.listen(serverPort, () =>
  console.log(`🚀 Server running on port ${serverPort}`)
);
