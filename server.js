const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const app = express();

// CORS options
const corsOptions = {
    origin: [
        'https://aryakrishna715.github.io/visitor-frontend', // Frontend URL
        'https://visitor-backend-23.onrender.com', // Render backend URL
    ],
    methods: 'GET, POST',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// MongoDB Atlas connection with a hardcoded URI
const mongoURI = "mongodb+srv://snehasnair1149:EbHrylGWLOYaNfyL@cluster0.xysjr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // Replace with your MongoDB URI
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch(err => console.error("MongoDB connection error:", err));

// Visitor Schema
const visitorSchema = new mongoose.Schema({
    visitorName: String,
    noOfPersons: Number,
    purpose: String,
    contactNumber: String,
    visitDate: String,
    createdAt: { type: Date, default: Date.now },
});
const Visitor = mongoose.model('Visitor', visitorSchema);

// Handle form submission and generate PDF
app.post('/submit', async (req, res) => {
    try {
        const { visitorName, noOfPersons, purpose, contactNumber, visitDate } = req.body;

        // Validate input data
        if (!visitorName || !noOfPersons || !purpose || !contactNumber || !visitDate) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        if (!/^[0-9]{10}$/.test(contactNumber)) {
            return res.status(400).json({ message: 'Invalid contact number. Please enter a 10-digit number.' });
        }
        if (isNaN(noOfPersons) || noOfPersons <= 0) {
            return res.status(400).json({ message: 'Invalid number of persons. Please enter a positive number.' });
        }

        // Save to database
        const visitor = new Visitor({ visitorName, noOfPersons, purpose, contactNumber, visitDate });
        const savedVisitor = await visitor.save();

        // Ensure public and pdf directories exist
        const publicDirectory = path.join(__dirname, 'public');
        const pdfDirectory = path.join(publicDirectory, 'pdfs');
        if (!fs.existsSync(publicDirectory)) fs.mkdirSync(publicDirectory);
        if (!fs.existsSync(pdfDirectory)) fs.mkdirSync(pdfDirectory);

        // PDF generation
        const pdfFilename = `${savedVisitor._id}-epass.pdf`;
        const pdfPath = path.join(pdfDirectory, pdfFilename);
        const doc = new PDFDocument();
        const logoPath = path.join(publicDirectory, 'logo.png');
        const mapPath = path.join(publicDirectory, 'map.png');
        const timezone = 'Asia/Kolkata';

        doc.pipe(fs.createWriteStream(pdfPath));
        doc.rect(10, 10, doc.page.width - 20, doc.page.height - 20).stroke('#000'); // Add a border

        // Add logo
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, doc.page.width - 110, 10, { fit: [100, 100], align: 'right' });
        }

        // Add content to the PDF
        doc.font('Times-Bold').fontSize(28).fillColor('blue')
            .text('Brindavan Group of Institutions', { align: 'center' });
        doc.moveDown();
        doc.fontSize(22).text('Visitor E-Pass', { align: 'center', underline: true });
        doc.moveDown();
        doc.font('Helvetica').fontSize(18).fillColor('black')
            .text(`Visitor Name: ${visitorName}`)
            .text(`Number of Persons: ${noOfPersons}`)
            .text(`Purpose: ${purpose}`)
            .text(`Contact Number: ${contactNumber}`)
            .text(`Visit Date: ${visitDate}`)
            .text(`Created At: ${savedVisitor.createdAt.toLocaleString('en-US', { timeZone: timezone })}`);
        doc.moveDown();

        doc.fontSize(20).text('Thank you for visiting us!', { align: 'center' });
        doc.moveDown();
        doc.fontSize(22).fillColor('blue').text('BGI Map', { align: 'center' });
        doc.moveDown();

        if (fs.existsSync(mapPath)) {
            doc.image(mapPath, { fit: [500, 400], align: 'center' });
        } else {
            doc.text('Map not available.');
        }
        doc.end();

        // Generate download link
        const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
        const backendUrl = `${protocol}://${req.get('host')}`;
        const downloadLink = `${backendUrl}/pdf/${pdfFilename}`;

        // Send response with download link
        res.json({
            success: true,
            message: 'E-Pass generated successfully!',
            downloadLink: downloadLink,
        });
    } catch (err) {
        console.error("Error handling form submission:", err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Root message
app.get('/', (req, res) => {
    res.send('Visitor backend API is running.');
});

// Serve PDFs
app.use('/pdf', (req, res, next) => {
    const filePath = path.join(__dirname, 'public', 'pdfs', req.url);
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
        return res.sendFile(filePath);
    }
    res.status(404).send('File not found.');
});

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Start server
const PORT = 3001; // Set your desired port
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
