const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const https = require('https');
const helmet = require('helmet');

const app = express();

// Middleware for CORS, JSON parsing, and security headers
app.use(cors({ origin: '*' })); // Allows requests from all origins
app.use(bodyParser.json());
app.use(helmet()); // Adding security headers like Content-Security-Policy, X-Content-Type-Options, etc.

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
        const pdfPath = path.join(pdfDirectory, `${savedVisitor._id}-epass.pdf`);
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
            doc.image(mapPath, { fit: [400, 400], align: 'center', valign: 'center' });
        } else {
            doc.text('Map image not available.');
        }

        doc.end();

        // Send response with download link
        const backendUrl = req.protocol + '://' + req.get('host');
        res.json({
            success: true,
            message: 'E-Pass generated successfully!',
            downloadLink: `${backendUrl}/pdf/${savedVisitor._id}-epass.pdf`,
        });
    } catch (err) {
        console.error("Error handling form submission:", err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Serve PDFs for download with Content-Disposition header
app.get('/pdf/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'pdfs', req.params.filename);
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
        res.download(filePath, (err) => {
            if (err) {
                console.error("Error sending file:", err);
                res.status(500).send('Error downloading the file.');
            }
        });
    } else {
        res.status(404).send('File not found');
    }
});

// Serve static files (like images, CSS, etc.)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Force HTTPS redirection (important for production)
app.use((req, res, next) => {
    if (req.protocol !== 'https') {
        return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
});

// SSL configuration for HTTPS (requires SSL certificate)
const options = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')), // Path to your private key
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem')), // Path to your certificate
};

// Start HTTPS server
const PORT = 3001;
https.createServer(options, app).listen(PORT, () => {
    console.log(`Secure server running on https://localhost:${PORT}`);
});
