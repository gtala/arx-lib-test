import axios from 'axios';

// Define the expected response structure
interface VersionResponse {
    version: string; // Adjust based on the actual API response structure
}

// Function to get version data using async/await
export const getVersionData = async (): Promise<VersionResponse | undefined> => {
    try {
        const response = await axios.get<VersionResponse>('https://4994-152-171-119-6.ngrok-free.app/version');

        // Log and return the version data
        console.log('Version Data:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching version data:', error);
    }
};