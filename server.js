const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const app = express();

// CORS options to allow specific origins
const corsOptions = {
    origin: [
        'https://aryakrishna715.github.io/visitor-frontend/submit', // Replace with actual frontend URL
        'http://localhost:3001', // Add localhost for local testing if needed
    ],
    methods: 'GET, POST',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true, // Allow credentials if needed
};

// Middleware for CORS and JSON parsing
app.use(cors(corsOptions)); // Allows requests from specified origins
app.use(bodyParser.json());

// MongoDB Atlas connection
const mongoURI = "mongodb+srv://snehasnair1149:EbHrylGWLOYaNfyL@cluster0.xysjr.mongodb.net/visitorDB?retryWrites=true&w=majority";

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log("Successfully connected to MongoDB Atlas");
    })
    .catch(err => {
        console.error("Error connecting to MongoDB Atlas:", err);
    });

// Schema and Model for Visitor
const visitorSchema = new mongoose.Schema({
    visitorName: String,
    noOfPersons: Number,
    purpose: String,
    contactNumber: String,
    visitDate: String,
    createdAt: { type: Date, default: Date.now },
});
const Visitor = mongoose.model('Visitor', visitorSchema);

// Route to handle form submission and PDF generation
app.post('/submit', async (req, res) => {
    try {
        const { visitorName, noOfPersons, purpose, contactNumber, visitDate } = req.body;

        // Save visitor data to MongoDB
        const visitor = new Visitor({ visitorName, noOfPersons, purpose, contactNumber, visitDate });
        const savedVisitor = await visitor.save();

        // Prepare directory for saving PDFs
        const pdfDirectory = path.join(__dirname, 'public', 'pdfs');
        if (!fs.existsSync(pdfDirectory)) {
            fs.mkdirSync(pdfDirectory, { recursive: true });
        }

        // Generate PDF e-pass
        const pdfFilename = `${savedVisitor._id}-epass.pdf`;
        const pdfPath = path.join(pdfDirectory, pdfFilename);
        const doc = new PDFDocument();

        // Add logo to the top-right
        const logoPath = path.join(__dirname, 'public', 'logo.png');
        const mapPath = path.join(__dirname, 'public', 'map.png');
        const timezone = 'Asia/Kolkata'; // Adjust based on your timezone

        doc.pipe(fs.createWriteStream(pdfPath));
        doc.rect(10, 10, doc.page.width - 20, doc.page.height - 20).stroke('#000'); // Border

        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, doc.page.width - 110, 10, { fit: [100, 100], align: 'right' });
        }

        // Main content
        doc.font('Times-Bold').fontSize(28).fillColor('blue')
            .text('Brindavan Group of Institutions', { align: 'center' });
        doc.moveDown();
        doc.fontSize(22).fillColor('black')
            .text('Visitor E-Pass', { align: 'center', underline: true });
        doc.moveDown();
        doc.font('Helvetica').fontSize(18).fillColor('black');
        doc.text(`Visitor Name: ${visitorName}`);
        doc.text(`Number of Persons: ${noOfPersons}`);
        doc.text(`Purpose of Visit: ${purpose}`);
        doc.text(`Contact Number: ${contactNumber}`);
        doc.text(`Visit Date: ${visitDate}`);
        doc.text(`Creation Time: ${savedVisitor.createdAt.toLocaleString('en-US', { timeZone: timezone })}`);
        doc.moveDown();

        // Thank-you note
        doc.fontSize(20).fillColor('black')
            .text('Thank you for visiting us!', { align: 'center' });
        doc.moveDown();

        // Map section
        doc.fontSize(22).fillColor('blue')
            .text('BGI Map', { align: 'center' });
        doc.moveDown();

        if (fs.existsSync(mapPath)) {
            doc.image(mapPath, { fit: [500, 400], align: 'center', valign: 'center' });
        } else {
            doc.text('Map image not available.');
        }

        doc.end();

        // Ensure the backend URL uses HTTPS
        const protocol = 'https';
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

// Handle requests to the root of the server
app.get('/', (req, res) => {
    res.send('Visitor backend API is running');
});

// Serve PDFs with correct MIME Type
app.use('/pdf', (req, res, next) => {
    const filePath = path.join(__dirname, 'public', 'pdfs', req.url);
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
        return res.sendFile(filePath);
    }
    res.status(404).send('File not found');
});

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on https://localhost:${PORT}`);
});
