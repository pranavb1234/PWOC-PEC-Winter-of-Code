import express from 'express';
import { createClient } from 'redis';
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';
import cors from 'cors';
import { getProjects, getContributors } from "./spreadsheets.js";
import { exportToExcel } from './util.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const PWOC_URL= process.env.PWOC_URL;
console.log("PWOC_URL", PWOC_URL);
app.use(cors({
    origin: ['http://localhost:3000', PWOC_URL],
}));

// Redis configuration
let redisClient;
try {
    redisClient = createClient({
        username: 'default',
        password: process.env.REDIS_PASSWORD,
        socket: {
            host: process.env.REDIS_URL,
            port: 14279
        }
    });

    redisClient.on('error', (err) => console.error('Redis Client Error:', err));

    await redisClient.connect();
    console.log('Connected to Redis successfully.');
} catch (err) {
    console.error('Error initializing Redis:', err);
    process.exit(1); // Exit process if Redis fails to connect
}

// Test Redis connection
try {
    await redisClient.set('foo', 'bar');
    const result = await redisClient.get('foo');
    console.log(result); // >>> bar
} catch (err) {
    console.error('Error testing Redis connection:', err);
}

// Helper function to fetch leaderboard data
const fetchLeaderboard = async () => {
    try {
        let octokit = new Octokit({ auth: process.env.GITHUB_ACCESS_TOKEN });
        let contributors = await getContributors();
        let projects = await getProjects();
        let repositories = projects.map((project) =>
            project.githubLink.trim().replace('https://github.com/', '')
        );

        let repoRequests = repositories.map(async (repo) => {
            let [owner, repoName] = repo.split('/');
            return await octokit.paginate(octokit.rest.pulls.list, {
                owner,
                repo: repoName,
                state: 'closed',
                per_page: 100,
            });
        });

        let repoResponses = await Promise.all(repoRequests);
        let pullRequestMap = new Map();
        let nameMap = new Map();

        contributors.forEach((user) => {
            if (user.username.length > 0) {
                pullRequestMap.set(user.username, []);
                nameMap.set(user.username, user.name);
            }
        });

        repoResponses.forEach((pullRequests) => {
            pullRequests.forEach((pr) => {
                pr.repository_url = pr.html_url.split('/').slice(0, 5).join('/');
                if (
                    pr.merged_at &&
                    pr.labels.some((label) =>
                        ['pwoc'].includes(
                            label.name.trim().toLowerCase()
                        )
                    )&&
                    pr.labels.some((label) =>
                        ['easy', 'medium', 'hard'].includes(
                            label.name.trim().toLowerCase()
                        )
                    )
                ) {
                    const userLogin = pr.user.login;
                    if (!pullRequestMap.has(userLogin)) {
                        pullRequestMap.set(userLogin, []);
                    }
                    pullRequestMap.get(userLogin).push(pr);
                }
            });
        });

        let leaderboard = [];
        pullRequestMap.forEach((pullRequests, username) => {
            if (pullRequests.length === 0) return;

            let points = 0;
            pullRequests.forEach((pr) => {
                let labels = pr.labels.map((label) => label.name.trim().toLowerCase());
                if (labels.includes('hard')) points += 6;
                else if (labels.includes('medium')) points += 4;
                else if (labels.includes('easy')) points += 2;
                else points += 1;
            });

            leaderboard.push({
                user: {
                    username: username,
                    name: nameMap.get(username) || username,
                    avatar_url: pullRequests[0].user.avatar_url,
                    html_url: pullRequests[0].user.html_url,
                },
                pullRequests: pullRequests.sort((p1, p2) =>
                    p2.closed_at.localeCompare(p1.closed_at)
                ),
                points: points,
            });
        });

        return leaderboard.sort((a, b) => {
            if (b.points === a.points) {
                return a.pullRequests[0].closed_at.localeCompare(
                    b.pullRequests[0].closed_at
                );
            }
            return b.points - a.points;
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        throw new Error('Failed to fetch leaderboard data.');
    }
};

// Helper function to fetch graveyard leaderboard data
const fetchGraveyardLeaderboard = async () => {
    try {
        let octokit = new Octokit({ auth: process.env.GITHUB_ACCESS_TOKEN });
        let contributors = await getContributors();

        const pullRequests = await octokit.paginate(octokit.rest.pulls.list, {
            owner: 'PEC-CSS',
            repo: 'Graveyard2025',
            state: 'closed',
            per_page: 100,
        });

        let pullRequestMap = new Map();
        let nameMap = new Map();

        contributors.forEach((user) => {
            if (user.username.length > 0) {
                pullRequestMap.set(user.username, []);
                nameMap.set(user.username, user.name);
            }
        });

        pullRequests.forEach((pr) => {
            pr.repository_url = pr.html_url.split('/').slice(0, 5).join('/');
            if (
                pr.merged_at &&
                pr.labels.some((label) =>
                    ['graveyard', 'easy', 'medium', 'hard'].includes(
                        label.name.trim().toLowerCase()
                    )
                )
            ) {
                const userLogin = pr.user.login;
                if (!pullRequestMap.has(userLogin)) {
                    pullRequestMap.set(userLogin, []);
                }
                pullRequestMap.get(userLogin).push(pr);
            }
        });

        let leaderboard = [];
        pullRequestMap.forEach((pullRequests, username) => {
            if (pullRequests.length === 0) return;

            let points = 0;
            pullRequests.forEach((pr) => {
                let labels = pr.labels.map((label) => label.name.trim().toLowerCase());
                if (labels.includes('hard')) points += 6;
                else if (labels.includes('medium')) points += 4;
                else if (labels.includes('easy')) points += 2;
                else points += 1;
            });

            leaderboard.push({
                user: {
                    username: username,
                    name: nameMap.get(username) || username,
                    avatar_url: pullRequests[0].user.avatar_url,
                    html_url: pullRequests[0].user.html_url,
                },
                pullRequests: pullRequests.sort((p1, p2) =>
                    p2.closed_at.localeCompare(p1.closed_at)
                ),
                points: points,
            });
        });

        return leaderboard.sort((a, b) => {
            if (b.points === a.points) {
                return a.pullRequests[0].closed_at.localeCompare(
                    b.pullRequests[0].closed_at
                );
            }
            return b.points - a.points;
        });
    } catch (error) {
        console.error('Error fetching graveyard leaderboard:', error);
        throw new Error('Failed to fetch graveyard leaderboard data.');
    }
};

// Function to refresh Redis cache for graveyard
const refreshGraveyardCache = async () => {
  try {
    console.log('Refreshing graveyard leaderboard cache...');
    const leaderboard = await fetchGraveyardLeaderboard();
    await redisClient.set('graveyard', JSON.stringify(leaderboard));

    //for local only
    // exportToExcel(leaderboard, 'graveyard_leaderboard.xlsx');
    // console.log('Graveyard leaderboard cache and Excel updated.');

    //for production only
    console.log('Graveyard cache updated.');
  } catch (error) {
    console.error('Error updating graveyard cache:', error);
  }
};

// Function to refresh Redis cache every 10 minutes
const refreshLeaderboardCache = async () => {
  try {
    console.log('Refreshing leaderboard cache...');
    const leaderboard = await fetchLeaderboard();
    await redisClient.set('leaderboard', JSON.stringify(leaderboard));

    //for local only
    // exportToExcel(leaderboard, 'leaderboard.xlsx');
    // console.log('Leaderboard cache and Excel updated.');

    //for production only
    console.log('Leaderboard cache updated.');
  } catch (error) {
    console.error('Error updating leaderboard cache:', error);
  }
};

// Set up periodic cache refresh
setInterval(refreshLeaderboardCache, 5 * 60 * 1000); // Every 5 minutes
refreshLeaderboardCache(); // Initial cache population


// Set up periodic cache refresh for graveyard
setInterval(refreshGraveyardCache, 5 * 60 * 1000); // Every 5 minutes
refreshGraveyardCache(); // Initial cache population

// API Endpoint to fetch leaderboard
app.get('/leaderboard', async (req, res) => {
  try {
    const cachedData = await redisClient.get('leaderboard');
    if (cachedData) {
      res.json(JSON.parse(cachedData));
    } else {
      res.status(500).json({ error: 'Leaderboard data not available' });
    }
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API Endpoint to fetch graveyard leaderboard
app.get('/graveyard', async (req, res) => {
  try {
    const cachedData = await redisClient.get('graveyard');
    if (cachedData) {
      res.json(JSON.parse(cachedData));
    } else {
      res.status(500).json({ error: 'Graveyard data not available' });
    }
  } catch (error) {
    console.error('Error fetching graveyard leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API Endpoint to fetch projects information
app.get('/projects', async (req, res) => {
    try {
      const projects = await getProjects();
      if (projects) {
        res.json(projects);
      } else {
        res.status(500).json({ error: 'Projects data not available' });
      }
    } catch (error) {
      console.error('Error fetching projects', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

// API Endpoint to fetch contributors information
app.get('/contributors', async (req, res) => {
    try {
      const contributors = await getContributors();
      if (contributors) {
        res.json(contributors);
      } else {
        res.status(500).json({ error: 'Contributors data not available' });
      }
    } catch (error) {
      console.error('Error fetching contributors', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
