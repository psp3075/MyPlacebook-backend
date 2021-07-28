const { v4: uuidv4 } = require("uuid");

const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const HttpError = require("../models/http-error");
const getCoordsForAddress = require("../util/location");
const Place = require("../models/place");
const User = require("../models/user");

let DUMMY_PLACES = [
  {
    id: "p1",
    title: "Empire STate Building",
    description: "one of the famous sky scrapers in the world",
    location: {
      lat: 40.7484474,
      long: -733.9871516,
    },
    address: "20 W 34th St, New York, NY 10001",
    creator: "u1",
  },
];

const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid;
  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError("something went wrong,could not find a place");
    return next(error);
  }

  if (!place) {
    const error = new HttpError("Couldnt find the place for this id", 404);
    return next(error);
  }
  res.json({
    place: place.toObject({ getters: true }), //place:place
  });
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;
  let places;
  try {
    places = await Place.find({ creator: userId });
  } catch (err) {
    const error = new HttpError(
      "Fetching places failed, please try again later",
      500
    );
    return next(error);
  }
  if (!places || places.length === 0) {
    return next(new HttpError("Couldnt find the place for this user id", 404));
  }
  res.json({
    places: places.map((place) => place.toObject({ getters: true })), //place:place
  });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("inputs are not valid,please check your data", 422)
    );
  }
  const { title, description, address, creator } = req.body;
  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
    console.log(coordinates);
  } catch (error) {
    return next(error);
  }
  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image:
      "https://res.cloudinary.com/dwzmsvp7f/image/fetch/q_75,f_auto,w_1316/http%3A%2F%2Fres.cloudinary.com%2Fdwzmsvp7f%2Fimage%2Fupload%2Fv1571728662%2Fdosvapsdbjorfgc92ol4.jpg",
    creator,
  });

  let user;
  try {
    user = await User.findById(creator);
  } catch (err) {
    const error = new HttpError("creating place failed, please try again", 500);
    return next(error);
  }

  if (!user) {
    const error = new HttpError("could not find user for provided id", 404);
    return next(error);
  }

  console.log(user);
  try {
    //transaction and session
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError("creating place failed, please try again", 500);
    return next(error);
  }

  res.status(201).json({ place: createdPlace });
};

const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("inputs are not valid,please check your data", 422)
    );
  }
  const { title, description } = req.body;
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      "something went wrong,couldn't find placeId. please try again",
      500
    );
    return next(error);
  }
  place.title = title;
  place.description = description;
  try {
    await place.save();
  } catch (err) {
    //console.log(err);
    const error = new HttpError(
      "something went wrong,could not update. please try again",
      500
    );
    return next(error);
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;
  let place;
  try {
    place = await Place.findById(placeId).populate("creator");
  } catch (err) {
    const error = new HttpError(
      "something went wrong,could not delete place. please try again",
      500
    );
    return next(error);
  }

  if (!place) {
    //console.log(place);

    const error = new HttpError("could not find place for this id.", 404);
    return next(error);
  }
  try {
    //transaction and session
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.remove({ session: sess });
    place.creator.places.pull(place);
    await place.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    console.log(err);
    const error = new HttpError(
      "something went wrong,could not delete place. please try again",
      500
    );
    return next(error);
  }
  res.status(200).json({ message: "Deleted place" });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
