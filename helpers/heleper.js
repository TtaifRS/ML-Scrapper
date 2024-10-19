import chalk from 'chalk';
import { performance } from 'perf_hooks';

export const logElapsedTime = (startTime, title) => {
  const endTime = performance.now();
  const elapsedTimeInSeconds = ((endTime - startTime) / 1000).toFixed(2); // Convert milliseconds to seconds
  const elapsedTimeInMinutes = (elapsedTimeInSeconds / 60).toFixed(2); // Convert seconds to minutes

  console.log(chalk.blue(`Time elapsed for title ${title}: ${elapsedTimeInMinutes} minutes`));
};

export const randomWait = (min, max) => {
  const waitTime = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`Waiting for ${waitTime} milliseconds...`);
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};

export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};


// helpers/heleper.js
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


