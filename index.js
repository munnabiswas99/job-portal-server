const express = require("express");
const cors = require("cors");
const app = express();
var jwt = require('jsonwebtoken');
const cookieParser = require("cookie-parser");

const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
app.use(cookieParser());
app.use(cors({
    origin: ["http://localhost:5173"],
    credentials: true
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Job portal is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.etxtqbz.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //connect to the collection
    const jobCollection = client.db("jobPortal").collection("jobs");
    const applicationCollection = client
      .db("jobPortal")
      .collection("application");

      // jwt token related api
      app.post('/jwt', async (req, res) => {
        const userData = req.body;
        const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, {expiresIn: '1d'})
        
        res.cookie('token', token, {
          httpOnly: true,
          secure: false
        })
        res.send({success: true})
      })

    //find data from the collection
    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if(email){
        query.hr_email = email;
      }

      const cursor = jobCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    //insert a document in job collection
    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      // console.log(newJob)
      const result = await jobCollection.insertOne(newJob);
      res.send(result);
    });

    // Find a doccument using id
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(query);
      res.send(result);
    });

    // Job Applications get api
    app.get("/applications", async (req, res) => {
      const email = req.query.email;

      const query = {
        applicant: email,
      };

      const result = await applicationCollection.find(query).toArray();

      for (const application of result) {
        const jobId = application.jobId;

        const jobQuery = { _id: new ObjectId(jobId) };
        const job = await jobCollection.findOne(jobQuery);

        if (job) {
          application.company = job.company;
          application.title = job.title;
          application.company_logo = job.company_logo;
          application.location = job.location;
          application.jobType = job.jobType;
        }
      }

      res.send(result);
    });

    // Job application post api

    app.post("/applications", async (req, res) => {
      const application = req.body;
      const result = await applicationCollection.insertOne(application);
      res.send(result);
    });

    // Find all applications on a specific job
    app.get("/applications/job/:id", async(req, res) => {
        const jobId = req.params.id;
        console.log(jobId)
        const query = {jobId: jobId}
        const result = await applicationCollection.find(query).toArray();
        res.send(result)
    })

    // Update application status
    app.patch("/applications/:id", async (req, res) => {
        const id = req.params.id;
        const status = req.body;
        const filter = {_id: new ObjectId(id)}

        const updatedDoc = {
            $set: {status : req.body.status}
        }

        const result = await applicationCollection.updateOne(filter, updatedDoc);
        res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Job Portal is listening on port ${port}`);
});
