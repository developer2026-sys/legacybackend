const cloudinary = require('cloudinary').v2;
const path=require('path')
const fs=require('fs')
// Configuration 
cloudinary.config({
  cloud_name:"dbjwbveqn",
  api_key: "774241215571685",
  api_secret: "ysIyik3gF03KPDecu-lOHtBYLf8"
});


module.exports.cloudinaryUploadImage=async(filetoUpload)=>{
  try{
   
    const data = await cloudinary.uploader.upload(filetoUpload, { resource_type: 'auto' });
  return { url: data.secure_url };
}catch(e){
  console.log(e.message)
return e
}
}



module.exports.uploadAndCleanup = async (file, folder = 'lasting-legacy') => {
    try {
      const data = await cloudinary.uploader.upload(file.path, {
        resource_type: 'auto',
        folder,
      });
      return {
        url: data.secure_url,
        publicId: data.public_id,
        originalName: file.originalname,
        mimeType: file.mimetype,
      };
    } finally {
      fs.unlink(file.path, () => {});
    }
  };


module.exports.cloudinaryUploadPdf=async(filetoUpload)=>{
  try{
    const dirPathnew = '/tmp/public/files/pdf';
    console.log(dirPathnew)
   const data=await cloudinary.uploader.upload(path.join(dirPathnew, filetoUpload),{
       resource_type:'auto'
   })
   
    return {
      url:data.secure_url
    }
}catch(e){
return e
}
}