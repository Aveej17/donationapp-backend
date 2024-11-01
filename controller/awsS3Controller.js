const AWS = require('aws-sdk');

// Set up AWS S3 config
const s3 = new AWS.S3({
    accessKeyId:process.env.IAM_USER_KEY,
    secretAccessKey:process.env.IAM_USER_SECRET
    
});


// Function to upload file to S3
exports.uploadFileToS3 = async (fileName, fileContent) => {
    const params = {
        Bucket: process.env.BUCKET_NAME, // Your bucket name
        Key: fileName, // File name you want to save as
        Body: fileContent, // File content (binary data)
        ContentType: 'image/jpg', // Change this to the correct content type for your file
        ACL:'public-read'
    };

    const data = await s3.upload(params).promise();
    return data.Location; // This returns the file URL
    
};


exports.downloadReceipt = async (donationId, pdfStream) => {
    
    // Define S3 upload parameters
    const s3Params = {
        Bucket: process.env.BUCKET_NAME,
        Key: `receipts/receipt_${donationId}.pdf`, // S3 file path
        Body: pdfStream,
        ContentType: 'application/pdf',
        ACL: 'public-read', // Allows public access to the file
    };

    // Upload the PDF to S3
    
    const data = await s3.upload(s3Params).promise();
        // console.log(data+"data");
        
    return data.Location;
};