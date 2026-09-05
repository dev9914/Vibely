import {v2 as cloudinary} from "cloudinary"
import fs from "fs"
import "../config/env.js";


cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// const uploadOnCloudinary = async (localFilePath) => {
//     try {
//         if (!localFilePath) return null


//         //upload the file on cloudinary
//         const response = await cloudinary.uploader.upload(localFilePath, {
//             resource_type: "auto"
//         })
//         // file has been uploaded successfull
//         //console.log("file is uploaded on cloudinary ", response.url);
//         fs.unlinkSync(localFilePath)
//         return response;

//     } catch (error) {
//         fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
//         return null;
//     }
// }

const uploadOnCloudinary = async (localFilePaths) => {
    const paths = Array.isArray(localFilePaths) ? localFilePaths : [];

    try {
        if (paths.length === 0) return null;

        // Map over the array of file paths and upload each file
        const uploadPromises = paths.map(async (filePath) => {
            // Upload each file to Cloudinary
            const response = await cloudinary.uploader.upload(filePath, {
                resource_type: "auto",
            });

            // Remove the local file after uploading
            fs.unlinkSync(filePath);

            return response; // Return the Cloudinary response for this file
        });

        // Wait for all files to be uploaded and return the responses
        const uploadResults = await Promise.all(uploadPromises);
        return uploadResults; // Return an array of Cloudinary responses

    } catch (error) {
        // Clean up: If an error occurs, remove all files
        paths.forEach((filePath) => {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch {
                // Ignore cleanup errors while handling the upload failure.
            }
        });
        return null;
    }
};



export {uploadOnCloudinary}