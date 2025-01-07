/************************************************
 * netlify/functions/generate-report.js
 ************************************************/
const OpenAI = require('openai');
const axios = require('axios');

/**
 * Initialize OpenAI with your API key.
 * Ensure OPENAI_API_KEY is set in your Netlify environment.
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Utility function: Safely convert a value to a string,
 * returning fallback if it's null/undefined or empty.
 */
function safeString(value, fallback = '') {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return fallback;
}

/**
 * Utility function: Safely join an array. If it's not a valid array
 * or it's empty, return an empty string.
 */
function safeArrayJoin(arr, separator = ', ') {
  if (Array.isArray(arr) && arr.length > 0) {
    return arr.join(separator);
  }
  return '';
}

/**
 * Utility function: Safely parse a date.
 * If parsing fails or the input is missing, return null.
 */
function safeParseDate(dateString) {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Fetch historical weather data with safe checks.
 * If the date is in the future or unavailable, we handle that gracefully.
 */
async function getWeatherData(location, dateString) {
  try {
    if (!location || !dateString) {
      return { success: true, data: {} };
    }
    const dateObj = safeParseDate(dateString);
    if (!dateObj) {
      return { success: true, data: {} };
    }

    // If the date is after "today," skip or note that it's a future date.
    const today = new Date();
    if (dateObj > today) {
      return { 
        success: true, 
        data: {
          note: `Weather data not found for a future date: ${dateObj.toISOString().split('T')[0]}`
        }
      };
    }

    const formattedDate = dateObj.toISOString().split('T')[0];

    // Attempt call to Weather API
    const response = await axios.get('http://api.weatherapi.com/v1/history.json', {
      params: {
        key: process.env.WEATHER_API_KEY,
        q: location,
        dt: formattedDate
      }
    });

    const dayData = response.data.forecast.forecastday[0].day;
    const hourlyData = response.data.forecast.forecastday[0].hour;
    const maxWindGust = Math.max(...hourlyData.map(hour => hour.gust_mph));
    const maxWindTime = hourlyData.find(hour => hour.gust_mph === maxWindGust)?.time || '';

    return {
      success: true,
      data: {
        maxTemp: `${dayData.maxtemp_f}°F`,
        minTemp: `${dayData.mintemp_f}°F`,
        avgTemp: `${dayData.avgtemp_f}°F`,
        maxWindGust: `${maxWindGust} mph`,
        maxWindTime,
        totalPrecip: `${dayData.totalprecip_in} inches`,
        humidity: `${dayData.avghumidity}%`,
        conditions: dayData.condition.text,
        hailPossible: dayData.condition.text.toLowerCase().includes('hail') ? 'Yes' : 'No',
        thunderstorm: dayData.condition.text.toLowerCase().includes('thunder') ? 'Yes' : 'No'
      }
    };
  } catch (error) {
    console.error('Weather API Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Build the prompt for each section, instructing GPT to NOT produce 
 * the heading itself—only the body text. That way, we avoid duplicates.
 */
async function generateSectionPrompt(sectionName, context, weatherData, customInstructions = '') {
  // Safely extract fields
  const investigationDate   = safeString(context?.investigationDate);
  const dateOfLoss          = safeString(context?.dateOfLoss);
  const claimTypeString     = safeArrayJoin(context?.claimType);
  const propertyType        = safeString(context?.propertyType);
  const propertyAge         = safeString(context?.propertyAge);
  const constructionType    = safeString(context?.constructionType);
  const currentUse          = safeString(context?.currentUse);
  const squareFootage       = safeString(context?.squareFootage);
  const address             = safeString(context?.address);
  const clientName          = safeString(context?.clientName);
  const engineerName        = safeString(context?.engineerName);
  const engineerEmail       = safeString(context?.engineerEmail);
  const engineerLicense     = safeString(context?.engineerLicense);
  const engineerPhone       = safeString(context?.engineerPhone);
  const propertyOwnerName   = safeString(context?.propertyOwnerName);
  const projectName         = safeString(context?.projectName);
  const affectedAreas       = safeArrayJoin(context?.affectedAreas);

  // Build a short weather summary if available
  let weatherSummary = '';
  if (weatherData?.note) {
    weatherSummary = `Weather Data Note: ${weatherData.note}`;
  } else if (Object.keys(weatherData || {}).length > 0) {
    weatherSummary = JSON.stringify(weatherData, null, 2);
  }

  // Big system instruction: GPT should NOT produce the headings 
  // (like "Introduction") in its text, to prevent duplication.
  const bigSystemInstruction = `
You are an expert forensic engineer generating professional report sections. 
IMPORTANT: Do NOT produce a heading at the top. The code will insert that heading. 
So only produce the BODY TEXT for this section.

Key points:
1. Avoid placeholders like [e.g., ...], [N/A], or repeated headings.
2. If date is in the future or weather data is missing, note it briefly but do not say "N/A."
3. The user’s claim type(s): ${claimTypeString}.
4. Address: ${address}.
5. Building details: ${propertyType}, age: ${propertyAge}, use: ${currentUse}, sq ft: ${squareFootage}.
6. Weather data summary: ${weatherSummary}.
7. Do not produce the section name as a heading, only body text.
`;

  const basePrompts = {
    introduction: `
You are writing the body text for "Introduction." 
Do NOT include the heading. 
Focus on property at ${address}, DOL ${dateOfLoss}, inspection date ${investigationDate}, 
reason for inspection (claim type: ${claimTypeString}), etc.
`,

    authorization: `
You are writing the body text for "Authorization and Scope of Investigation."
Do NOT include the heading. 
Summarize who authorized, the scope, tasks, references, etc.
`,

    background: `
You are writing the body text for "Background Information."
Do NOT include the heading. 
Include property type, age, construction, current use, sq ft, project name, property owner, etc.
`,

    observations: `
You are writing the body text for "Site Observations and Analysis."
Do NOT include the heading. 
Affected areas: ${affectedAreas}; claim types: ${claimTypeString}.
Only mention details the user input indicates.
`,

    moisture: `
You are writing the body text for the "Survey" (Moisture) section.
Do NOT include the heading. 
Discuss moisture presence/absence, etc.
`,

    meteorologist: `
You are writing the body text for "Meteorologist Report."
Do NOT include the heading. 
Use the data: ${weatherSummary}.
`,

    conclusions: `
You are writing the body text for "Conclusions and Recommendations."
Do NOT include the heading. Summarize final opinions, recommended steps, etc.
`,

    rebuttal: `
You are writing the body text for "Rebuttal."
Do NOT include the heading. If no conflicting reports, keep it minimal.
`,

    limitations: `
You are writing the body text for "Limitations."
Do NOT include the heading. Provide disclaimers about scope, data reliance, etc.
`,

    tableofcontents: `
You are writing the body text for "Table of Contents."
Do NOT include the heading. Just list sections simply.
`,

    openingletter: `
You are writing the body text for "Opening Letter."
Do NOT include the heading. 
Include a greeting, DOL, inspection date, claim type(s), address, 
and a sign-off with engineer's name/license/email/phone.
`
  };

  const normalizedSection = (sectionName || '').trim().toLowerCase();
  const fallbackPrompt = `
Write the BODY TEXT for section: ${sectionName}, 
without repeating the section name as a heading at the top.
`;

  const basePrompt = basePrompts[normalizedSection] || fallbackPrompt;
  const safeCustom = safeString(customInstructions, '');
  const finalPrompt = safeCustom 
    ? `${basePrompt}\n\nAdditional instructions:\n${safeCustom}`
    : basePrompt;

  // Merge with big system instructions
  const fullPrompt = `
${bigSystemInstruction}

Now produce the body text for the section named "${sectionName}". 

${finalPrompt}
`;

  return fullPrompt;
}

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { section, context: userContext, customInstructions } = JSON.parse(event.body) || {};

    // Attempt weather data fetch for sections except tableOfContents, openingLetter, introduction
    let weatherResult = { success: true, data: {} };
    const lowerSection = (section || '').trim().toLowerCase();

    if (!['tableofcontents', 'openingletter', 'introduction'].includes(lowerSection)) {
      const dateObj = safeParseDate(userContext?.dateOfLoss);
      if (dateObj && userContext?.address) {
        // Attempt weather call
        weatherResult = await getWeatherData(userContext.address, dateObj.toISOString().split('T')[0]);
      }
    }

    // Build final prompt
    const prompt = await generateSectionPrompt(section, userContext, weatherResult.data, customInstructions);

    // Create Chat Completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', 
      // or 'gpt-4' if you have it
      messages: [
        {
          role: 'system',
          content: prompt
        }
      ],
      temperature: 0.0,  // reduce creativity
      max_tokens: 3000
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        section: completion.choices[0].message.content || '',
        sectionName: section,
        weatherData: weatherResult.data
      })
    };
  } catch (error) {
    console.error('Error in generate-report function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate report section',
        details: error.message
      })
    };
  }
};
