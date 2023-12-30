import {asyncHandler} from "../utils/asyncHandler.js";
//Higher Order function that accepts function as parameters



const registerUser = asyncHandler( async (req, res) => {
    res.status(200).json({
        message: "catalina"
    })
} )

export { registerUser }