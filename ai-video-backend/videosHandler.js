import { supabase } from "./services/supabaseClient.js";
import renderHandler from "./renderHandler.js";

// Create new video job and start rendering
export async function createVideo(req, res) {
  try {
    const { user_id, topic, voice, art_style, aspect_ratio, music_track, video_length } = req.body;

    // Create video record
    const { data, error } = await supabase
      .from("videos")
      .insert([
        {
          user_id,
          topic,
          voice,
          art_style,
          aspect_ratio,
          music_track,
          video_length,
          status: "pending",
        },
      ])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    const video = data[0];
    console.log("Video created, starting render for ID:", video.id);

    // Update status to indicate rendering started
    await supabase
      .from("videos")
      .update({ status: "processing" })
      .eq("id", video.id);

    // Trigger rendering immediately
    try {
      // Create a mock request object for the render handler
      const renderReq = {
        method: "POST",
        params: { id: video.id },
        body: {}
      };
      
      const renderRes = {
        status: (code) => ({
          json: (data) => {
            console.log("Render response:", code, data);
            return { status: code, data };
          }
        }),
        json: (data) => {
          console.log("Render success:", data);
          return data;
        }
      };

      // Start rendering in background (don't wait)
      renderHandler(renderReq, renderRes).catch(err => {
        console.error("Background render failed:", err);
        // Update video status to failed
        supabase
          .from("videos")
          .update({ status: "failed" })
          .eq("id", video.id);
      });

      // Return immediately with video info
      res.json({ 
        video,
        message: "Video created and rendering started. Check status or wait for completion."
      });

    } catch (renderError) {
      console.error("Failed to start rendering:", renderError);
      
      // Update status to failed
      await supabase
        .from("videos")
        .update({ status: "failed" })
        .eq("id", video.id);
      
      return res.status(500).json({ 
        error: "Video created but rendering failed to start",
        video
      });
    }

  } catch (err) {
    console.error("POST /api/videos error:", err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
}

// Get all videos for a user
export async function getVideosByUser(req, res) {
  try {
    const { user_id } = req.params;
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ videos: data });
  } catch (err) {
    console.error("GET /api/videos error:", err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
}

// Get a single video by id
export async function getVideoById(req, res) {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ video: data });
  } catch (err) {
    console.error("GET /api/videos/:id error:", err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
}
