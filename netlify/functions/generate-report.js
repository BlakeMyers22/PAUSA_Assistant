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
 * Build the prompt for each section, making sure we avoid
 * placeholders, contradictory roof info, multi-story references
 * if it's a single story, etc.
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

  // We won’t parse every single sub-field for roofing, but you can expand if you want GPT to see them.
  // This example just demonstrates how to keep the text consistent.
  
  // Weather data
  let weatherSummary = '';
  if (weatherData?.note) {
    weatherSummary = `Weather Data Note: ${weatherData.note}`;
  } else if (Object.keys(weatherData || {}).length > 0) {
    weatherSummary = JSON.stringify(weatherData, null, 2);
  }

  // Large system instruction to keep the generation consistent
  const bigSystemInstruction = `
You are an expert forensic engineer generating professional report sections. 
Use only the data from user inputs; do not invent details that contradict them.

Key points:
1. Avoid mentioning roofing types or multi-story details the user did not specify.
2. Keep Date of Loss (${dateOfLoss}) separate from Investigation Date (${investigationDate}).
3. If weather data is missing or the date is in the future, note that briefly rather than "N/A".
4. Avoid placeholders like [e.g., ...], [N/A], [Third Party].
5. The user’s claim types: ${claimTypeString}.
6. Property address: ${address}.
7. The client name: ${clientName} or property owner: ${propertyOwnerName}.
8. Building type: ${propertyType}, age: ${propertyAge}, use: ${currentUse}, sq ft: ${squareFootage}.
9. Weather Data Summary: ${weatherSummary}
`;

  const basePrompts = {
    introduction: `
"Introduction" for a forensic engineering report.
Address: ${address}
Date of Loss: ${dateOfLoss}
Inspection Date: ${investigationDate}
Claim Type(s): ${claimTypeString}
Explain the purpose of the inspection, referencing hail, wind, or other claimed causes.
`,

    authorization: `
"Authorization and Scope of Investigation"
Include who authorized it, the scope of work, tasks performed, references if any.
`,

    background: `
"Background Information"
Include:
- Property Type: ${propertyType}
- Age: ${propertyAge}
- Construction Type: ${constructionType}
- Current Use: ${currentUse}
- Square Footage: ${squareFootage}
- Project Name: ${projectName}
- Property Owner: ${propertyOwnerName}
`,

    observations: `
"Site Observations and Analysis"
Affected areas: ${affectedAreas}
Claim type(s): ${claimTypeString}
Include only user-indicated details (e.g., if TPO hail damage is indicated, mention it). 
`,

    moisture: `
"Survey" (Moisture) section.
Discuss moisture presence or absence based on user data. 
No contradictory statements.
`,

    meteorologist: `
"Meteorologist Report" section.
Use weather data from:
${weatherSummary}
If not available, note that.
`,

    conclusions: `
"Conclusions and Recommendations"
Summarize final opinions on the cause of loss and recommended next steps.
`,

    rebuttal: `
"Rebuttal" section.
If no conflicting or third-party reports are indicated, keep it minimal or note that none exist.
`,

    limitations: `
"Limitations" section.
Typical disclaimers about scope, data reliance, and so forth.
`,

    tableofcontents: `
"Table of Contents" in markdown:
1. Opening Letter
2. Introduction
3. Authorization and Scope of Investigation
4. Background Information
5. Site Observations and Analysis
6. Survey
7. Meteorologist Report
8. Conclusions and Recommendations
9. Rebuttal
10. Limitations
`,

    openingletter: `
"Opening Letter" for the final report.
Include:
- Date of Loss: ${dateOfLoss}
- Investigation Date: ${investigationDate}
- Claim Type(s): ${claimTypeString}
- Address: ${address}
- Greeting
- Signature block with ${engineerName}, license ${engineerLicense}, email ${engineerEmail}, phone ${engineerPhone}
`
  };

  const normalizedSection = (sectionName || '').trim().toLowerCase();
  const fallbackPrompt = `Write a professional section: ${sectionName}, using only user inputs.`;

  const basePrompt = basePrompts[normalizedSection] || fallbackPrompt;

  const safeCustom = safeString(customInstructions, '');
  const finalPrompt = safeCustom 
    ? `${basePrompt}\n\nAdditional instructions:\n${safeCustom}`
    : basePrompt;

  // Merge with big system instructions
  const fullPrompt = `
${bigSystemInstruction}

Now produce the "${sectionName}" section.

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
