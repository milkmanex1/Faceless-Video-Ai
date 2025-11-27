const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL
  }

  async request(endpoint, options = {}) {
    //this is where the API URL is defined. So its the base URL + the endpoint.
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  // Create a new video
  async createVideo(videoData) {
    return this.request('/videos', {
      method: 'POST',
      body: JSON.stringify(videoData),
    })
  }

  // Get all videos for a user
  async getVideosByUser(userId) {
    return this.request(`/videos/user/${userId}`)
  }

  // Get a single video by ID
  async getVideoById(videoId) {
    return this.request(`/videos/${videoId}`)
  }

  // Start rendering a video
  async renderVideo(videoId) {
    return this.request(`/render/${videoId}`, {
      method: 'POST',
    })
  }

  // Poll video status
  async pollVideoStatus(videoId, onStatusChange = null) {
    const poll = async () => {
      try {
        const { video } = await this.getVideoById(videoId)
        
        if (onStatusChange) {
          onStatusChange(video.status, video)
        }
        
        // Continue polling if video is still processing
        if (video.status === 'processing' || video.status === 'pending') {
          setTimeout(poll, 5000) // Poll every 5 seconds
        }
        
        return video
      } catch (error) {
        console.error('Error polling video status:', error)
        throw error
      }
    }
    
    return poll()
  }
}

export const apiService = new ApiService()
export default apiService
