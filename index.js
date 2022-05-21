const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();

// use middleware
app.use(cors());
app.use(express.json());

// Mongodb
const uri = `mongodb+srv://${process.env.USER_ID}:${process.env.SECRET_KEY}@cluster0.xyj46.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// async function run() {
//   await client.connect();

//   try {
//   } finally {
//     //   await client.close();
//   }
// }

// run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server start");
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
