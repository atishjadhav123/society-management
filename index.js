const express = require("express")
const mongoose = require("mongoose")
require("dotenv").config()
const app = express()
const cors = require("cors")
const path = require("path");
const cookieParser = require("cookie-parser")

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.static(path.join(__dirname, "dist")));
app.use(cookieParser())
app.use(express.json())


app.use("/api/auth", require("./routes/auth.route"))
app.use("/api/societies", require("./routes/society.route"))
app.use("/api/community-admin", require("./routes/communityAdmin.route"));
app.use("/api/resident", require("./routes/resident.route"));
app.use('/api/security-guards', require("./routes/security.route"));
app.use('/api/complaints', require("./routes/complaints.route"));
app.use('/api/free-trial', require("./routes/freeTrialRoutes"));



// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({ message: "Server is running", status: "OK" })
})
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
});
mongoose.connect(process.env.MONGO_URL)
mongoose.connection.once("open", () => {
    console.log("mongo conected")
    app.listen(process.env.PORT, console.log("server running"))
})



