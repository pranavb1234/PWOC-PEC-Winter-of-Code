import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const SHEET_ID = process.env.SHEET_ID; 


const auth = new google.auth.GoogleAuth({
  credentials: {
    type: process.env.TYPE,
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    auth_uri: process.env.AUTH_URI,
    token_uri: process.env.TOKEN_URI,
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

export const getProjects = async () => {
  try {
    const range = 'Sheet1!A1:Z1000'; 
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data found in the spreadsheet.');
      return [];
    }

    const projects = rows.slice(1).map((row) => ({
      mentorEmail: row[1],
      mentor: row[2],
      mentorLinkedinLink: row[3],
      mentorGithubLink: row[4],
      title: row[5],
      githubLink: row[6],
      description: row[7],
      techStack: row[8]?.split(',').map((tech) => tech.trim().toLowerCase()) || [],
      deploymentLink: row[9],
      mentorMobileNumber: Number(row[10]),
      mentorDiscordUsername: row[11],
    }));

    return projects;
  } catch (error) {
    console.error('Error fetching projects:', error);
  }
};

export const getContributors = async () => {
  try {
    const range = 'Sheet2!A1:Z1000';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data found in the spreadsheet.');
      return [];
    }

    const contributors = rows.slice(1).map((row) => ({
      name: row[2],
      email: row[1],
      college: row[3],
      mobileNumber: row[4],
      githubLink: row[5],
      username: row[5]?.trim().replace('https://github.com/', ''),
    }));

    return contributors;
  } catch (error) {
    console.error('Error fetching contributors:', error);
  }
};

