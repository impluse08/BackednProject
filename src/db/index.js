import mongoose from "mongoose";
import { DB_NAME } from "../constanst.js";


const connectDB = ( async () =>{
    try{
        const conectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n MonogDB Connected !! DB HOST: ${conectionInstance.connection.host}`);
    }catch (error){
        console.log("MONGODB connection failed: ",error);
        process.exit(1)
    }
})

export default connectDB;