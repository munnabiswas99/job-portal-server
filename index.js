require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();

//CORS Config
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://job-portal-11fa2.web.app",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// JWT Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    req.decoded = decoded;
    next();
  });
};

// Root Route
app.get("/", (req, res) => {
  res.send("Job portal server is running.");
});

// connect to MongoDB 
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.etxtqbz.mongodb.net/?retryWrites=true&w=majority`;

let client;
let db;

async function connectDB() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("jobPortal");
    console.log("MongoDB connected");
  }
  return db;
}

// JWT ROUTE
app.post("/jwt", async (req, res) => {
  try {
    const { email } = req.body;

    const token = jwt.sign(
      { email },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

// JOB ROUTES
// Get Jobs
app.get("/jobs", async (req, res) => {
  try {
    const db = await connectDB();
    const jobCollection = db.collection("jobs");

    const email = req.query.email;
    const query = email ? { hr_email: email } : {};

    const result = await jobCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

// Add Job
app.post("/jobs", async (req, res) => {
  try {
    const db = await connectDB();
    const jobCollection = db.collection("jobs");

    const result = await jobCollection.insertOne(req.body);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

// Get Single Job
app.get("/jobs/:id", async (req, res) => {
  try {
    const db = await connectDB();
    const jobCollection = db.collection("jobs");

    const result = await jobCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

// APPLICATION ROUTES
// Get Applications (Protected)
app.get("/applications", verifyToken, async (req, res) => {
  try {
    const db = await connectDB();
    const applicationCollection = db.collection("application");
    const jobCollection = db.collection("jobs");

    const email = req.query.email;

    if (email !== req.decoded.email) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const applications = await applicationCollection
      .find({ applicant: email })
      .toArray();

    // Attach job info
    for (const appItem of applications) {
      const job = await jobCollection.findOne({
        _id: new ObjectId(appItem.jobId),
      });

      if (job) {
        appItem.company = job.company;
        appItem.title = job.title;
        appItem.company_logo = job.company_logo;
        appItem.location = job.location;
        appItem.jobType = job.jobType;
      }
    }

    res.send(applications);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

// Apply Job
app.post("/applications", async (req, res) => {
  try {
    const db = await connectDB();
    const applicationCollection = db.collection("application");

    const result = await applicationCollection.insertOne(req.body);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

// Applications by Job
app.get("/applications/job/:id", async (req, res) => {
  try {
    const db = await connectDB();
    const applicationCollection = db.collection("application");

    const result = await applicationCollection
      .find({ jobId: req.params.id })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

// Update Status
app.patch("/applications/:id", async (req, res) => {
  try {
    const db = await connectDB();
    const applicationCollection = db.collection("application");

    const result = await applicationCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: req.body.status } }
    );

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

app.delete("/application/:id", async (req, res) => {
  try {
    const db = await connectDB();
    const applicationCollection = db.collection("application");

    const id = req.params.id;
    const query = { _id: new ObjectId(id) };

    const result = await applicationCollection.deleteOne(query);

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

// LOGOUT
app.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite:
      process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  res.send({ success: true });
});

// EXPORT FOR VERCEL
module.exports = app;

// For Loaclhost
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}