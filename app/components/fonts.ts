"use client";
import React from "react";
import localFont from "next/font/local";

const variableFont = localFont({ src: "../fonts/Font_Variable.otf", display: "swap" });
const titleFont = localFont({ src: "../fonts/Font_VariableBold.otf", display: "swap" });

export { variableFont, titleFont };