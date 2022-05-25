const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


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
  // console.log(authHeader)
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
    const reviewCollections = client.db("Manufacturer").collection("reviews");
    const userCollections = client.db("Manufacturer").collection("users");
    const paymentCollections = client.db("Manufacturer").collection("payment");

    // verify Admin
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollections.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    };


    // create a user in db & give jwt token
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      // console.log(email)
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollections.updateOne(filter, updateDoc, options);
      // give jwt to clint
      const token = jwt.sign({ email: email }, process.env.JWT_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ result, token });
    });

    // chack admin
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollections.findOne(query);
      const isAdmin = user?.role === "admin";
      res.send({ admin: isAdmin });
    });

    // make admin
    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollections.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get all products from db
    app.get("/product", async (req, res) => {
      const products = await productCollections.find().toArray();
      res.send(products);
    });

    // get a product from db
    app.get("/product/:id", verifyJWT, async (req, res) => {
      const id = req.params.id
      const query = { _id: ObjectId(id) }
      const product = await productCollections.findOne(query)
      res.send(product)
    })

    app.delete("/booking/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await bookingCollections.deleteOne(filter);
      res.send(result);
    });


    // update user
    app.put("/userprofile/:email", async (req, res) => {
      const email = req.params.email;
      // console.log(email)
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollections.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    // get all user info from db
    app.get("/user", verifyJWT, async (req, res) => {
      const users = await userCollections.find().toArray()
      res.send(users)
    })

    // get a user info from db
    app.get("/user/:email", verifyJWT, async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const user = await userCollections.findOne(query)
      res.send(user)
    })

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

    // find order for singel person booking
    app.get("/booking", verifyJWT, async (req, res) => {
      const user = req.query.user;

      // jwt verify
      const decodedEmail = req.decoded.email;
      if (user === decodedEmail) {
        const query = { email: user };
        const bookings = await bookingCollections.find(query).toArray();
        return res.send(bookings);
      } else {
        return res.status(403).send({ Message: "Forbidden access" });
      }
    });


    // get a booking by id
    app.get("/booking/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingCollections.findOne(query);
      res.send(booking);
    });

    // payment
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({ clientSecret: paymentIntent.client_secret })
    });

    // booking after payment
    app.patch("/booking/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const result = await paymentCollections.insertOne(payment);
      const updatedBooking = await bookingCollections.updateOne(filter, updatedDoc);
      res.send(updatedBooking);
    });

    // add review
    app.post("/review", verifyJWT, async (req, res) => {
      const review = req.body;
      const result = await reviewCollections.insertOne(review);
      res.send(result);
    });

    // get all review
    app.get('/review', async (req, res) => {
      const reviews = await reviewCollections.find().toArray()
      res.send(reviews)
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
