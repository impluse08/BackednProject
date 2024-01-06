import {asyncHandler} from "../utils/asyncHandler.js";
//Higher Order function that accepts function as parameters
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse,.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudnary.js"
import jwt from "jsonwebtoken"


const generateAccessAndRefereshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refersh and access token")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    // Get Data from the user
    // Validation - not empty
    // check if user already exists
    // check for images, check for avatar
    // upload them to cloudinar, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return response

    // console.log("req.body",req.body);
    // console.log("email", email);

    // if (fullName === ""){
    //     throw new ApiError(400, "fullname is required")
    // }
    const {fullName, email, username, password} = req.body
    if (
        [fullName,email,username,password].some((field) => field?.trim() === "") 
    ) {
        throw new ApiError(400, "ALl fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username },{ email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    // console.log("req.files",req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    }
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar =  await uploadOnCloudinary(avatarLocalPath)
    const coverImage =  await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong whiel registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registerd Succesfully")
    )
} )

const loginUser = asyncHandler( async (req,res) => {
    // req body -> data
    // Get input of data from the user, username or email
    // find the user
    // validate the username and password
    // access token and refresh tokesn
    // send cookies
    // send response

    const {email, username, password} = req.body
    // console.log(email, password);
    if (!username && !email){
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(400,"User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401,"Invalid user credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    // console.log(accessToken, "refreshtoken",refreshToken);
//cookies mai bhejo
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // console.log(loggedInUser);
    const options = {
        httpOnly: true,
        secure: true
    }

    return res.
    status(200)
    .cookie("accessToken",accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req, res) => {
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler( async(req, res) =>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "refresh token is expired or used")
        }
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newrefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newrefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newrefreshToken},
                "Access token is refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refreshtoken")
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)   
    const isPasswordCorect = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorect) {
        throw new ApiError(400, "Invalid old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})
    return res
    .status(200)
    (new ApiResponse(200, {}, "password changed succesfully"))
})

const getCurrentUser = asyncHandler(async(req,res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req,res) => {
    const {fullName, email} = req.body
    if (!(fullName || email)){
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        res.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated "))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.files?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }
    
    const user = await User.findByIdAndUpdate(
        res.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar details updated Succesfully  "))
})

const updateCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image file is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on Cover Image")
    }
    
    const user = await User.findByIdAndUpdate(
        res.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image details updated Succesfully "))
})


export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateCoverImage
}