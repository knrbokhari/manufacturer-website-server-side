const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
const uri = `mongodb+srv://${process.env.USER_ID}:${process.env.SECRET_KEY}@cluster0.lznyk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// jwt funtion
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log(authHeader)
  if (!authHeader) {
    return res.status(401).send({ Message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ Message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    const productCollections = client.db("Manufacturer").collection("products");
    const bookingCollections = client.db("Manufacturer").collection("booking");
    const commentCollections = client.db("Manufacturer").collection("comments");
    const userCollections = client.db("Manufacturer").collection("users");


    // get all products from db
    app.get("/product", async (req, res) => {
      const products = await productCollections.find().toArray();
      res.send(products);
    });

    // get a product from db
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: ObjectId(id) }
      const product = await productCollections.findOne(query)
      res.send(product)
    })

    //
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email)
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollections.updateOne(filter, updateDoc, options);
      // give jwt to clint
      const token = jwt.sign({ email: email }, process.env.JWT_TOKEN, {
        expiresIn: "1m",
      });
      res.send({ result, token });
    });

    // Insert a booking
    app.post("/booking", async (req, res) => {
      const booking = req.body
      const query = {
        email: booking.email,
        productName: booking.productName,
      };
      const exists = await bookingCollections.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollections.insertOne(booking);
      return res.send({ success: true, result });
    })


  } finally {
    //   await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server start");
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
