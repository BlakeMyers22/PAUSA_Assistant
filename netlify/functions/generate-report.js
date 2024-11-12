const OpenAI = require('openai');
const axios = require('axios');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Function to fetch historical weather data
async function getWeatherData(location, date) {
  try {
    const response = await axios.get(`http://api.weatherapi.com/v1/history.json`, {
      params: {
        key: process.env.WEATHER_API_KEY,
        q: location,
        dt: date // format: YYYY-MM-DD
      }
    });

    const dayData = response.data.forecast.forecastday[0].day;
    const hourlyData = response.data.forecast.forecastday[0].hour;

    // Get max wind gust from hourly data
    const maxWindGust = Math.max(...hourlyData.map(hour => hour.gust_mph));
    const maxWindTime = hourlyData.find(hour => hour.gust_mph === maxWindGust)?.time || 'N/A';

    return {
      success: true,
      data: {
        maxTemp: `${dayData.maxtemp_f}°F`,
        minTemp: `${dayData.mintemp_f}°F`,
        avgTemp: `${dayData.avgtemp_f}°F`,
        maxWindGust: `${maxWindGust} mph`,
        maxWindTime: maxWindTime,
        totalPrecip: `${dayData.totalprecip_in} inches`,
        humidity: `${dayData.avghumidity}%`,
        conditions: dayData.condition.text,
        hailPossible: dayData.condition.text.toLowerCase().includes('hail') ? 'Yes' : 'No',
        thunderstorm: dayData.condition.text.toLowerCase().includes('thunder') ? 'Yes' : 'No'
      }
    };
  } catch (error) {
    console.error('Weather API Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Function to generate section content with section-specific prompts
async function generateSection(sectionName, context, weatherData, customInstructions = '') {
  const sectionPrompts = {
    'authorization': `You are writing the "Authorization and Scope of Investigation" section for a forensic engineering report. Follow this format but vary the wording:

Background:
- Investigation Date: ${context.investigationDate}
- Property Address: ${context.location}
- Client: ${context.clientName}
- Date of Loss: ${context.dateOfLoss}
- Claimed Cause: ${context.claimType}

Required Elements:
1. State the site investigation details (date, location, requestor)
2. Explain the purpose (evaluate ${context.claimType} damage from reported date of loss)
3. Detail the scope of investigation (photo documentation, analysis, etc.)
4. Mention appendices that will be included:
   - Inspection Photo Report (Appendix A)
   - Roof Moisture Survey (Appendix B)
   - Meteorologist Report (Appendix C)
5. Reference any third-party reports reviewed

Format this similarly to: "A site investigation was completed by North Star Forensics (NSF), LLC on [date]..." but use your own professional engineering language.`,

    'background': `You are writing the "Background Information" section for a forensic engineering report. Include these details:

Property Information:
- Type: ${context.propertyType}
- Age: ${context.propertyAge} years
- Construction: ${context.constructionType}
- Current Use: ${context.currentUse}
- Square Footage: ${context.squareFootage}

Required Elements:
1. Describe building construction and materials
2. Detail architectural features and systems
3. Note current use and year built
4. Include square footage and layout details
5. Describe roof system and exterior finishes

Use professional engineering language while maintaining accuracy and detail.`,

    'observations': `You are writing the "Site Observations and Analysis" section for a forensic engineering report. Include:

Investigation Areas:
- Components: ${context.affectedAreas.join(', ')}
- Damage Type: ${context.claimType}
- Engineer Notes: ${context.engineerNotes}

Required Elements:
1. Initial methodology statement
2. Organize by component areas:
   ${context.affectedAreas.map(area => `- ${area} investigation details`).join('\n   ')}
3. For each component:
   - Detailed observations
   - Analysis of damage patterns
   - Correlation with reported cause
4. Reference photo documentation (Appendix A)

Write in a professional engineering style, similar to the sample format but with unique phrasing.`,

    'moisture': `You are writing the "Roof Moisture Survey" section for a forensic engineering report. Include:

Survey Details:
- Investigation Date: ${context.investigationDate}
- Property Type: ${context.propertyType}
- Roof Type: Based on property description

Key Elements:
1. Survey methodology
2. Equipment used (standard moisture detection tools)
3. Findings overview
4. Reference to detailed results in Appendix B
5. Significance of findings

Write professionally, noting that full details are in Appendix B.`,

    'meteorologist': `You are writing the "Meteorologist Report" section for a forensic engineering report. Include:

Weather Data:
${JSON.stringify(weatherData, null, 2)}
Date of Loss: ${context.dateOfLoss}

Required Elements:
1. Weather data analysis
2. Specific conditions:
   - Wind speeds and patterns
   - Precipitation levels
   - Temperature variations
   - Storm characteristics
3. Correlation with reported damage
4. Reference to full report in Appendix C

Write professionally, focusing on weather impact on observed damage.`,

    'conclusions': `You are writing the "Conclusion and Recommendations" section for a forensic engineering report. Include:

Analysis Basis:
- Damage Type: ${context.claimType}
- Weather Data: ${JSON.stringify(weatherData)}
- Affected Areas: ${context.affectedAreas.join(', ')}
- Investigation Findings: ${context.engineerNotes}

Required Elements:
1. Main conclusions as bullet points:
   - Storm event impact and date
   - Weather correlation
   - Physical evidence
   - Supporting data
2. Specific recommendations:
   - Required repairs/replacements
   - Scope of work
   - Additional considerations

Follow the bullet-point format of the sample but use unique professional language.`,

    'rebuttal': `You are writing the "Rebuttal" section for a forensic engineering report. Include:

Context:
- Our Date of Loss: ${context.dateOfLoss}
- Our Investigation Date: ${context.investigationDate}
- Our Findings: Based on gathered evidence

Required Elements:
1. Reference to third-party reports
2. Professional disagreement points
3. Technical justification
4. Evidence references
5. Professional tone

Maintain professional disagreement while supporting positions with evidence.`,

    'limitations': `You are writing the "Limitations" section for a forensic engineering report. Include standard but uniquely worded:

Required Elements:
1. Scope limitations
2. Information availability statement
3. Scientific/engineering certainty statement
4. Examination conditions
5. Confidentiality statement
6. Additional study disclaimer
7. Report use restrictions

Follow professional standards while varying language from the sample.`
  };

  const basePrompt = sectionPrompts[sectionName.toLowerCase()];
  const finalPrompt = customInstructions 
    ? `${basePrompt}\n\nAdditional Instructions: ${customInstructions}\n\nModify the section according to these instructions while maintaining professional engineering standards.`
    : basePrompt;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are an expert forensic engineer generating professional report sections. Guidelines:
1. Use formal, technical language
2. Include specific context details
3. Maintain logical flow
4. Support conclusions with evidence
5. Reference documentation appropriately
6. Use unique phrasing
7. Ensure completeness
8. Incorporate custom instructions while maintaining standards`
      },
      {
        role: 'user',
        content: finalPrompt
      }
    ],
    temperature: 0.7,
    max_tokens: 1000
  });

  return completion.choices[0].message.content;
}

exports.handler = async function(event, context) {
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
    const { section, context, customInstructions } = JSON.parse(event.body);
    
    // Format date for weather API
    const formattedDate = new Date(context.dateOfLoss).toISOString().split('T')[0];
    
    // Get weather data
    const weatherResult = await getWeatherData(context.location, formattedDate);
    
    // Generate the requested section
    const sectionContent = await generateSection(
      section, 
      context, 
      weatherResult.data,
      customInstructions
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        section: sectionContent,
        sectionName: section,
        weatherData: weatherResult.data
      })
    };

  } catch (error) {
    console.error('Error:', error);
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
