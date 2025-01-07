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

  // Roof types from checkboxes
  const roofTypesDetected   = safeArrayJoin(context?.roofType);

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
1. Do NOT invent roofing types if the user only specifies TPO or single-ply, etc.
2. Do NOT mention multiple floors if the user has not indicated that (avoid referencing an upper floor if not specified).
3. Keep Date of Loss (${dateOfLoss}) separate from Inspection Date (${investigationDate}).
4. If weather data is missing or the date is in the future, note that briefly rather than printing "N/A".
5. Avoid placeholders like [e.g., ...], [N/A], [Third Party].
6. The user’s claim types: ${claimTypeString}.
7. The roof type(s) specified: ${roofTypesDetected}.
8. The property address: ${address}.
9. The client name: ${clientName} or property owner: ${propertyOwnerName} if needed.
10. The building type: ${propertyType}, age: ${propertyAge}, use: ${currentUse}, sq ft: ${squareFootage}.
11. Weather Data Summary: ${weatherSummary}
`;

  const basePrompts = {
    introduction: `
You are writing the "Introduction" for a forensic engineering report.
- Address: ${address}
- Date of Loss: ${dateOfLoss}
- Investigation Date: ${investigationDate}
- Claim Type(s): ${claimTypeString}
Explain the purpose of the inspection, referencing hail, wind, or other claimed causes.
Do not add contradictory roofing details.
`,

    authorization: `
You are writing the "Authorization and Scope of Investigation" section.
Include:
1) Who authorized it (e.g., property owner or law firm).
2) The scope of work (site visit, photos, etc.).
3) Summarize major tasks.
4) Note any references if available.
`,

    background: `
You are writing "Background Information."
Include relevant details:
- Property Type: ${propertyType}
- Age: ${propertyAge}
- Construction Type: ${constructionType}
- Current Use: ${currentUse}
- Square Footage: ${squareFootage}
- Project Name: ${projectName}
- Property Owner: ${propertyOwnerName}
No placeholders or contradictory info.
`,

    observations: `
You are writing "Site Observations and Analysis."
Affected areas: ${affectedAreas}.
Roof type(s): ${roofTypesDetected}.
Claim type(s): ${claimTypeString}.

Incorporate only what the user indicated. 
If user said TPO was punctured by hail, mention it. Do not mention asphalt shingles if not indicated.
`,

    moisture: `
"Survey" (Moisture) section.
If the user indicated interior water intrusion, mention it. Otherwise, be concise.
`,

    meteorologist: `
"Meteorologist Report" section.
Use the data:
${weatherSummary}
If not available or the date was in the future, note it. 
Focus on how it might tie into hail/wind claims.
`,

    conclusions: `
"Conclusions and Recommendations."
Summarize your final opinion on the cause(s) of loss. 
Propose next steps or repairs if relevant.
`,

    rebuttal: `
"Rebuttal" section. 
If no third-party or conflicting reports were indicated, keep minimal. 
Otherwise, address them.
`,

    limitations: `
"Limitations" section.
Typical disclaimers about data reliance, scope boundaries, site access, etc.
No placeholders.
`,

    tableofcontents: `
"Table of Contents" in markdown, with these headings in this order:

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
- Brief greeting
- Signature block: ${engineerName}, License: ${engineerLicense}, Email: ${engineerEmail}, Phone: ${engineerPhone}
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
      model: 'gpt-3.5-turbo', 
      // or 'gpt-4' if available
      messages: [
        {
          role: 'system',
          content: prompt
        }
      ],
      temperature: 0.0, // reduce "creative" contradictions
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
