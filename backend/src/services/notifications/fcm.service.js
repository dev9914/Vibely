import { getMessaging } from "../../utils/firebaseAdmin.js";
import { User } from "../../models/user.models.js";

/**
 * Send push notification to a single FCM token
 * @param {String} token - FCM device token
 * @param {Object} payload - Notification payload
 * @returns {Promise<Object>} - FCM response
 */
export const sendPushNotification = async (token, payload) => {
  try {
    const messaging = getMessaging();
    if (!messaging) {
      console.warn(
        "⚠️  Firebase messaging not initialized. Skipping push notification.",
      );
      return { success: false, message: "Firebase messaging not initialized" };
    }

    // Convert all data values to strings (FCM requirement)
    const processedData = {};
    if (payload.data) {
      Object.keys(payload.data).forEach((key) => {
        processedData[key] = String(payload.data[key]);
      });
    }

    const message = {
      token,
      // Include both notification and data for reliable delivery
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        ...processedData,
        title: payload.title,
        body: payload.body,
      },
      webpush: {
        fcmOptions: {
          link: payload.link || "/",
        },
      },
    };

    const response = await messaging.send(message);
    console.log("✅ Push notification sent successfully:", response);
    return { success: true, response };
  } catch (error) {
    console.error("❌ Error sending push notification:", error);

    // Handle specific FCM errors
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      return { success: false, invalidToken: true, error: error.message };
    }

    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to multiple tokens (multicast)
 * @param {Array<String>} tokens - Array of FCM tokens
 * @param {Object} payload - Notification payload
 * @returns {Promise<Object>} - Send result with success/failure counts
 */
export const sendMulticastNotification = async (tokens, payload) => {
  try {
    const messaging = getMessaging();
    if (!messaging) {
      console.warn(
        "⚠️  Firebase messaging not initialized. Skipping push notification.",
      );
      return {
        success: false,
        message: "Firebase messaging not initialized",
        successCount: 0,
        failureCount: tokens.length,
      };
    }

    if (!tokens || tokens.length === 0) {
      return {
        success: false,
        message: "No tokens provided",
        successCount: 0,
        failureCount: 0,
      };
    }

    // Convert all data values to strings (FCM requirement)
    const processedData = {};
    if (payload.data) {
      Object.keys(payload.data).forEach((key) => {
        processedData[key] = String(payload.data[key]);
      });
    }

    const message = {
    // Include both notification and data for reliable delivery
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      ...processedData,
      title: payload.title,
      body: payload.body,
    },
    webpush: {
      fcmOptions: {
        link: payload.link || "/",
      },
    },
    tokens,
  };

    console.log('[fcm.service.js] sendMulticastNotification() sending payload with notification and data', {
      tokenCount: tokens.length,
      dataKeys: Object.keys(processedData),
      link: payload.link || "/",
    });

    const response = await messaging.sendEachForMulticast(message);

    console.log(
      `✅ Multicast sent: ${response.successCount} success, ${response.failureCount} failed`,
    );

    // Collect invalid tokens for cleanup
    const invalidTokens = [];
    if (response.responses) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          if (
            error?.code === "messaging/invalid-registration-token" ||
            error?.code === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });
    }

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  } catch (error) {
    console.error("❌ Error sending multicast notification:", error);
    return {
      success: false,
      successCount: 0,
      failureCount: tokens.length,
      error: error.message,
    };
  }
};

/**
 * Send push notification to a user (all their active devices)
 * @param {String} userId - User ID
 * @param {Object} payload - Notification payload
 * @returns {Promise<Object>} - Send result
 */
export const sendPushToUser = async (userId, payload) => {
  try {
    console.log(`🔔 Sending push notification to user ${userId}`);

    // Get user with FCM tokens
    const user = await User.findById(userId).select('fcmTokens');
    if (!user) {
      console.log(`❌ User ${userId} not found`);
      return { success: false, message: "User not found" };
    }

    // Get only active tokens
    const activeTokens =
      user.fcmTokens?.filter((t) => t.isActive && t.token) || [];

    console.log('===== ACTIVE FCM TOKENS =====');
    console.log(activeTokens);
    console.log('Count:', activeTokens.length);
    console.log('==============================');

    if (activeTokens.length === 0) {
      console.log(`ℹ️  No active FCM tokens for user ${userId}`);
      return {
        success: false,
        message: "No active FCM tokens registered",
        activeTokens: 0,
      };
    }

    console.log(`📱 User has ${activeTokens.length} active token(s)`);

    // Update lastUsed timestamp
    const now = new Date();
    activeTokens.forEach((tokenObj) => {
      tokenObj.lastUsed = now;
    });
    await user.save();

    // Extract token strings
    const tokens = activeTokens.map((t) => t.token);

    // Send to all active tokens
    const result = await sendMulticastNotification(tokens, payload);

    // Handle invalid tokens (auto-cleanup)
    if (result.invalidTokens && result.invalidTokens.length > 0) {
      console.log(
        `🧹 Cleaning up ${result.invalidTokens.length} invalid tokens`,
      );
      await cleanupInvalidTokens(userId, result.invalidTokens);
    }

    return {
      success: result.successCount > 0,
      successCount: result.successCount,
      failureCount: result.failureCount,
      activeTokens: activeTokens.length,
      invalidTokensRemoved: result.invalidTokens?.length || 0,
    };
  } catch (error) {
    console.error("❌ Error sending push to user:", error);
    throw error;
  }
};

/**
 * Cleanup invalid FCM tokens
 * @param {String} userId - User ID
 * @param {Array<String>} invalidTokens - Array of invalid tokens
 */
export const cleanupInvalidTokens = async (userId, invalidTokens) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Remove invalid tokens
    user.fcmTokens = user.fcmTokens.filter(
      (t) => !invalidTokens.includes(t.token),
    );
    await user.save();

    console.log(
      `✅ Removed ${invalidTokens.length} invalid tokens for user ${userId}`,
    );
  } catch (error) {
    console.error("❌ Error cleaning up invalid tokens:", error);
  }
};
