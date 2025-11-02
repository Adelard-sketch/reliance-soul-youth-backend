import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/api/paystack-webhook", async (req, res) => {
  const { reference } = req.body;

  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: {
      Authorization: `Bearer YOUR_PAYSTACK_SECRET_KEY`,
    },
  });
  const data = await response.json();

  if (data.data.status === "success") {
    console.log("Donation verified:", data.data);
    // Send email notification to admin here
    res.sendStatus(200);
  } else {
    res.sendStatus(400);
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));
