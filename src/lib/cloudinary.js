import { v2 as cloudinary } from "cloudinary";
import logger from "@/utils/logger";

let configured = false;

function getEnv(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/**
 * Lazily configures the Cloudinary SDK from env.
 * Supports either the individual vars or a full CLOUDINARY_URL
 * (e.g. cloudinary://<key>:<secret>@<cloud_name>).
 * Returns true when uploads can be attempted.
 */
export function ensureCloudinaryConfigured() {
  if (configured) return true;

  const cloudinaryUrl = getEnv("CLOUDINARY_URL");
  const cloudName = getEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = getEnv("CLOUDINARY_API_KEY");
  const apiSecret = getEnv("CLOUDINARY_API_SECRET");

  if (cloudinaryUrl) {
    // The SDK natively honours CLOUDINARY_URL, but configuring explicitly
    // keeps behaviour deterministic even when only the URL var is set.
    try {
      cloudinary.config({ secure: true });
      configured = Boolean(cloudinary.config().cloud_name);
      if (!configured) {
        // Fall back to parsing the URL ourselves.
        const match = /^cloudinary:\/\/([^:]+):([^@]+)@([^/?]+)/.exec(cloudinaryUrl);
        if (match) {
          cloudinary.config({
            cloud_name: match[3],
            api_key: match[1],
            api_secret: match[2],
            secure: true,
          });
          configured = true;
        }
      }
    } catch (error) {
      logger.error("Cloudinary config from CLOUDINARY_URL failed.", error);
      configured = false;
    }
  } else if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    configured = true;
  }

  return configured;
}

export function isCloudinaryConfigured() {
  return ensureCloudinaryConfigured();
}

function buildPublicId(name = "") {
  const stem = String(name || "payment-screenshot")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(-60)
    .replace(/^_+|_+$/g, "");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}_${rand}_${stem || "payment-screenshot"}`;
}

/**
 * Uploads a validated base64 image data URL directly to Cloudinary and
 * resolves with the permanent `secure_url`. That URL is what callers persist
 * in MongoDB (invoice.paymentScreenshot, payments[].screenshot, screenshots[]
 * entries) so the image stays visible in the UI at any time.
 */
export async function uploadDataUrlToCloudinary(
  dataUrl,
  { name = "payment-screenshot.png", folder = "" } = {}
) {
  if (!ensureCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_URL or the CLOUDINARY_* vars.");
  }
  const targetFolder =
    folder || getEnv("CLOUDINARY_FOLDER") || "adsbuzz/payment-screenshots";
  const result = await cloudinary.uploader.upload(String(dataUrl), {
    folder: targetFolder,
    public_id: buildPublicId(name),
    resource_type: "image",
    overwrite: false,
    unique_filename: true,
  });
  const url = result?.secure_url || result?.url || "";
  if (!url) throw new Error("Cloudinary upload returned no URL.");
  return url;
}

export default cloudinary;
