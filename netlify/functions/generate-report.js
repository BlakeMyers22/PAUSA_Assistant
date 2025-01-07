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

    // If the date is after "today", skip or note it.
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

    // Attempt call to WeatherAPI
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
 * Build the prompt for each section, instructing GPT to NOT produce a heading
 * with the section name. Instead, it should produce only the body content.
 */
async function generateSectionPrompt(sectionName, context, weatherData, customInstructions = '') {
  // Extract fields
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

  // Affected areas
  const affectedAreas       = safeArrayJoin(context?.affectedAreas);

  // Weather data
  let weatherSummary = '';
  if (weatherData?.note) {
    weatherSummary = `Weather Data Note: ${weatherData.note}`;
  } else if (Object.keys(weatherData || {}).length > 0) {
    weatherSummary = JSON.stringify(weatherData, null, 2);
  }

  // Large system instruction to keep the generation consistent,
  // and to prevent GPT from duplicating headings like "Introduction" or "Table of Contents."
  const bigSystemInstruction = `
You are an expert forensic engineer generating professional report sections. 
IMPORTANT: Do NOT produce an extra heading at the top saying "Introduction," "Table of Contents," etc.
Why? Because our code adds a heading for the user automatically. 
So please only produce the BODY TEXT for this section. Avoid repeating the section name as a heading.

Key points:
1. Avoid placeholders like [e.g., ...], [N/A], or repeated headings.
2. Use the user’s data only. 
3. If date is in the future or weather data is missing, you may note it briefly but do not say "N/A."
4. The user’s claim type(s): ${claimTypeString}.
5. Address: ${address}.
6. Building details: ${propertyType}, age: ${propertyAge}, use: ${currentUse}, sq ft: ${squareFootage}.
7. Weather data summary: ${weatherSummary}.
8. Do not produce a heading that duplicates the section name. Just produce the content for the section.
`;

  // The base prompts remain the same, but we remove language that prompts GPT to produce a heading.
  const basePrompts = {
    introduction: `
You are writing the body text for the "Introduction." 
Do NOT include the word "Introduction" as a heading. 
Focus on the property at ${address}, the date of loss ${dateOfLoss}, the inspection date ${investigationDate}, 
and the reason for the inspection (claim type: ${claimTypeString}).
`,

    authorization: `
You are writing the body text for the "Authorization and Scope of Investigation" section.
Do NOT include the heading. 
Summarize who authorized the investigation, the scope, major tasks, references if any.
`,

    background: `
You are writing the body text for "Background Information."
Do NOT include the heading. 
Relevant details:
- Property Type: ${propertyType}, Age: ${propertyAge}, Construction: ${constructionType}
- Current Use: ${currentUse}, Square Footage: ${squareFootage}, etc.
- Project Name: ${projectName}, Property Owner: ${propertyOwnerName}
`,

    observations: `
You are writing the body text for the "Site Observations and Analysis."
Do NOT include the heading. 
Affected areas: ${affectedAreas}, claim type(s): ${claimTypeString}.
Mention only user-indicated details.
`,

    moisture: `
You are writing the body text for the "Survey" (Moisture) section.
Do NOT include the heading. 
Discuss moisture presence or absence. 
`,

    meteorologist: `
You are writing the body text for the "Meteorologist Report."
Do NOT include the heading. 
Use data from: ${weatherSummary}.
`,

    conclusions: `
You are writing the body text for "Conclusions and Recommendations."
Do NOT include the heading. 
Summarize final opinions on the cause of loss, recommended steps, etc.
`,

    rebuttal: `
You are writing the body text for the "Rebuttal" section.
Do NOT include the heading. 
If no conflicting reports are indicated, keep it minimal.
`,

    limitations: `
You are writing the body text for the "Limitations" section.
Do NOT include the heading. 
Standard disclaimers about scope, data reliance, etc.
`,

    tableofcontents: `
You are writing the body text for the "Table of Contents."
Do NOT include a heading that says "Table of Contents" again. 
Simply list or outline the sections in a minimal way, or as instructed.
`,

    openingletter: `
You are writing the body text for the "Opening Letter."
Do NOT include a heading. 
Include a brief greeting, date of loss, inspection date, claim type(s), address, 
and sign-off with the engineer’s name/license/email/phone.
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

    // Weather data fetch, skip for tableOfContents, openingLetter, introduction
    let weatherResult = { success: true, data: {} };
    const lowerSection = (section || '').trim().toLowerCase();

    if (!['tableofcontents', 'openingletter', 'introduction'].includes(lowerSection)) {
      const dateObj = safeParseDate(userContext?.dateOfLoss);
      if (dateObj && userContext?.address) {
        // Attempt weather call
        weatherResult = await getWeatherData(userContext.address, dateObj.toISOString().split('T')[0]);
      }
    }

    // Build prompt
    const prompt = await generateSectionPrompt(section, userContext, weatherResult.data, customInstructions);

    // Create chat completion
    const completion = await openai.chat.completions.create({
      model: 'chatgpt-4o-latest',
      messages: [
        {
          role: 'system',
          content: prompt
        }
      ],
      temperature: 0.0, // reduce "creative" contradictions
      max_tokens: 4000
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
