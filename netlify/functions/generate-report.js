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

// const EXAMPLE_REPORT = `
// INTRODUCTION

// 440 Plaza Shopping Center at 714 S. Fort Hood Road, Killeen, Texas is a retail complex with four 1-story commercial buildings. Satellite images and aerial photos of the complex are enclosed in Attachment A. To ensure that we use the same building identification system as used by Nelson Forensics (see below), we have included Nelson's roof diagram in Attachment A.

// The complex was damaged on March 28, 2014 during a windstorm with a peak three-second gust wind speed of 66.7 mph, recorded at Ft. Sill airport located 3 miles northeast of the complex (Weather History, Attachment B). A forensic weather company determined that hail with a maximum diameter of 2.0 inch fell at the property address (HailStrike, Attachment B).

// NELSON FORENSICS ROOF REPORT

// Nelson Forensics prepared a 356-page report dated September 25, 2014 addressing hail damage to the Buildings 1-3 roofs. Although typically in our reports we critique opposing opinions after describing our own findings and conclusions, given the chronology of events and the comprehensive nature of the Nelson report, we believe it will assist the reader if we summarize our understanding of the Nelson report before proceeding further with our own narrative. Additional comments concerning the Nelson report are found in the footnotes.

// WEATHER ANALYSIS

// Nelson researched public domain NOAA data and concluded there within a 5-mile radius of 440 Plaza, there was no hail event on March 28, 2014; 1-inch diameter hail on April 13, 2014; 1.75" diameter hail on three dates between 2001-2006; and 4.5" hail on two dates between 2000-2001. Table 1 below compares the maximum hail size reported by Nelson based on NOAA and two forensic weather companies, WeatherFusion and HailStrike, each using their own proprietary radar algorithms. Whereas Nelson documents no hail on the reported date of loss, WeatherFusion documents a maximum hail size less than 0.75 inch diameter and HailStrike documents 2.00 inch diameter. Accordingly, we believe that the appropriate date of loss is March 28, 2014.

// Date         Nelson (NOAA)    WeatherFusion    HailStrike
// April 13, 2014    1.00"          <0.75"          2.75"
// March 28, 2014      -             1.2"           2.00"
// April 20, 2006    1.75"           0.8"            n/a
// March 25, 2003    1.75"           n/a             n/a
// May 6, 2001       4.5"            n/a             n/a
// March 10, 2000    4.5"            n/a             n/a
// Table 1: Comparison of hail sizes by various reports

// Nelson cites "empirical research" by Koontz and Marshall, as well as its own experience, to support its proposition that "hail impact damage to ballasted BUR membranes starts to occur with hailstone sizes equal to or greater than 2" in diameter". Later in their report, Nelson elaborates that hail damage is a function of hail velocity as well as hail size.

// In other words, hail damage is proportional to the amount of kinetic energy imparted by the impact. Kinetic energy changes linear to hailstone mass and exponentially to hailstone velocity. The contribution of wind gust speed should not be overlooked in the analysis, especially since most published studies compare hail size and building damage under laboratory conditions simulating terminal velocity without adjusting for wind speed. Table 2 summarizes our findings concerning hail size, impact velocity and the resultant kinetic energy transfer associated with damage using 2-inch diameter hail falling at terminal velocity and within a storm moving at 29 mph on the reported date of loss (based on HailStrike). Columns 3 and 4 show the terminal velocity of hail falling at terminal velocity on a windless day (assuming an ice density of .91 g/cm³) and the kinetic energy upon impact (using an 90° angle of impact with the roof surface). Column 5 introduces the maximum wind gust speed for the period of hail fall. Columns 6 and 7 adjust the impact velocity and resultant kinetic energy for the maximum wind gust speed during the reported date of loss. The analysis does not consider the effect of unknown weather conditions such as updrafts, downbursts and drag due to the shape of individual hail stones.

// DATE      HAIL SIZE   TERM. VEL.    K.E.      MAX GUST    ADJUST    ADJUST
//                                                            VEL.      K.E.
// --------  2.00 IN     68.5 MPH    21.5 FT-LB   0 MPH     68.5 MPH  21.5 FT-LB
// 03/28/2014 2.00 IN    68.5 MPH    21.5 FT-LB   28.0 MPH  74.0 MPH  25.0 FT-LB
// 03/28/2014 2.00 IN    68.5 MPH    21.5 FT-LB   66.7 MPH  95.6 MPH  41.8 FT-LB
// Table 2: Hail size, velocity and kinetic energy

// Presuming the maximum hail size was 2.0 inch diameter, the calculated kinetic energy at terminal velocity is 21.5 ft-lbs. At the time of hail fall, the storm system was moving 28.0 mph, raising the kinetic energy upon impact to 25.0 ft-lbs. But storm speed is not the same as wind gust speed. If the wind gusts at the time of hail fall were as high as the 66.7 mph reported 3 miles northeast of the complex, at least some hail impacted with kinetic energy of 41.8 ft-lbs, nearly the same as 2.5 inch diameter hail at terminal velocity.

// GRAVEL-COVERED BUR MEMBRANES

// Nelson found "gravel-ballasted BUR" was found on Building 1, sections B, G, H, I and K, and Building 2, section M. The following are key Nelson observations concerning the gravel BUR membranes:

// • The roofs drained to the rear; gravel "ballast" coverage was consistently distributed except where it wasn't.

// • Splatter and burnish marks "up to ¾" in diameter" were found on roof vents and RTU metal shrouds; indentations "up to 1" in diameter" were found on roof top unit (RTU) condenser fins; and circular and semi-circular, unweathered fractures "up to 1¼" in diameter" were found on aluminum coated, roofing cement flashing on the parapets between F&G and L&M. Most RTU indentations were found on the north and west elevations.

// DURO-LAST MEMBRANES

// Nelson found Duro-Last membranes on all other roof sections; an elastomeric coating had been applied to roof sections C, F, L & N. The following are key Nelson observations concerning the Duro-Last membranes:

// • Splatter and burnish marks "up to ¾" in diameter" were found on the roof field, RTUs and flashings; "circular/semi-circular/concentric/radial fractures" up to 2" in diameter were found on the elastomeric coatings; indentations "up to 1" diameter" were found on roof vents, and indentations "up to ¾" in diameter" were found on condenser fins, predominantly on the north and west elevations.

// MOISTURE TESTING

// Nelson selected 69 core locations each approximately 12"x12": 25 cores on gravel BUR membranes and 4 cores on Duro-Last membranes. The Nelson cores extracted at Duro-Last locations showed no evidence of hail-caused damage to the polystyrene recovery board, similar to what we found during our own examination. At each of the core locations, Nelson used a Protimeter moisture meter measuring substrate in %MC, or %WME on a 6-100% scale. At 62 core locations, Nelson found that the roof assembly was dry. Moisture entrapment was found under the Duro-Last membrane at 7 core locations. Significantly, Nelson found little to no evidence of pitting, rust, or section loss on the metal decks of any of the 69 core locations. We interpret that as evidence that none of the moisture which we found under the roof coverings was caused by chronic leakage. On the other hand, although Nelson broke through and damaged the roof membrane at 69 locations, they seemed dissatisfied with their own finding, arguing that "the exact extent of rust...at these roof areas will [not]become evident [until the membrane is fully removed]". The catch is that Nelson opines it would take "several years" for moisture to rust the deck. Since it may be "several years" before the buildings are re-roofed, it will be impossible at that point to tell if the rust resulted from pre-loss conditions or moisture intrusion resulting from the March 28, 2014 date of loss.

// A more expeditious (and economical) way to check the entire roof area for entrapped moisture is an "electrical impedance survey". Nelson first proposes the survey, then argues against it because "the presence of multiple roofing layers will more than likely make the results inconclusive without extensive invasive testing throughout". Apparently, Nelson felt comfortable using their 69 cuts as "stand-alone" statistical data, but not in conjunction with a comprehensive impedance survey. We question this approach. Invasive testing -- because of its destructive nature -- is typically performed in support of non-invasive testing, not the other way around. Albeit Nelson's 69 cuts were acquired to evaluate "potential hail damage", Nelson could have oven-tested the acquired samples to ascertain actual moisture content for each layer of material in each of the cuts, instead of using a hand-held meter measuring %WME to a depth of ½ inch. We used a portable Tramex Deckscan impedance meter with a maximum scan depth of 6 inches combined with a sufficient number of core samples to calibrate the Deckscan readings. We also inspected ceilings and decks under the roof to inventory roof leaks, check the condition of the steel deck, and correlate interior damage with the overall condition of the roof assemblies (see below).

// ROOF MEMBRANE CORING & LAB ANALYSIS

// All of Nelson's 69 core samples were sent to Nelson Discovery Laboratory (NDL) where testing was performed "in general accordance" with Section 6.8 of ASTM D2829-07 and ASTM D5635/D5635M-11. Our opinion is that the Nelson lab analysis protocols have very little to do with the referenced ASTMs. We do not object to that, as forensic investigators often find it necessary to develop and employ non-standard techniques to solve unique problems. However, we take issue with Nelson's characterization of their protocols as being in accordance with the ASTM standards, when in fact they are not.

// Nelson lab test for BUR "membrane delamination"

// Nelson's membrane delamination test was performed "to evaluate the asphalt interply moppings...[of BUR membranes]...for evidence of impact distress", performed "in general accordance" with Section 6.8 of ASTM D2829-07. The purpose of this standard is to act as a "guide for removing test specimens from existing built-up roofing systems in the field and for determining the approximate quantities of the components of that specimen". Nelson followed the ASTM standard in regard to removing test specimens from existing BUR systems (pretty much what any roofer would do without special knowledge of the ASTM). The standard provides no method or practice for the identification of hail damage. Section 6.8 (specifically referenced by Nelson) only provides instructions on how-to separate the BUR plies by warming or cooling, in order "to determine the lapping distance of felts". In the lab, Nelson used liquid nitrogen (the ASTM recommends dry ice) to cool the plies in order to facilitate delamination. This practice complies with the intent of the ASTM, but does not remove the asphalt binder impregnated in the plies, in order to inspect the plies for hail-caused damage. Complete examinations for hail damage require the use of vapor degreaser to extract the asphalt binder. Without extracting the asphalt, it is not possible to perform a microscopic analysis with backlighting, by which the plies are fully examined for hail-caused damage. Not surprisingly, Nelson reported that 24 of 25 cores extracted at gravel BUR sections showed no "distress consistent with an impact force".

// Nelson "water column test"

// Nelson's water column test was performed in "general accordance" with ASTM D5635/D5635M-11). While this is true, it is somewhat misleading, since the water column test is only referenced as "Note 7", stating that "one type of watertightness test that has been used to examine whether membrane specimens have been punctured incorporates a water column sealed to the top of the membrane specimen". At any rate, Nelson reports that 21 of 44 sample failed the water column test, typically samples with "circular/semi-circular/concentric/radial fractures" on Duro-Last membranes date-stamped 1996, 1999 or 2000.

// A flaw with the test procedure is that the samples were only acquired in the roof field. To whatever extend wind force peeled and weakened the lap seams, allowing the penetration of water, this type of damage was not considered in the test procedure.

// NELSON'S CONCLUSIONS & RECOMMENDATIONS

// Nelson concluded that the gravel-covered BUR systems were not damaged by hail. The aluminum-coated, roofing cement flashing was damaged by hail, albeit Nelson could not determine the date of loss. Nelson recommended patching isolated fractures on the parapet flashing between sections F&G and L&M.

// Nelson concluded that Duro-Last membranes A, D, E & J (dated 2006, 2008 or undated) and O (dated 1999/2000) were not damaged by hail and their water-shedding capability was not compromised.

// Nelson concluded that Duro-Last membranes C, F, L & N (dated 1996) and B1, E1, L1, M1 & N1 (dated 1999/2000) were damaged by hail. Furthermore, the water-shedding capability of the roof membranes was compromised due to impacting hail. Nelson opined the damage was caused by multiple storms including those reported on/about the reported date of loss. Nelson recommended replacing the membranes over their roof sections in entirety, to be installed "as per applicable local building codes, manufacturer's recommendations, and industry standards".

// NELSON FORENSICS MECHANICAL EQUIPMENT REPORT

// Nelson Forensics prepared a 263-page report dated September 25, 2014 addressing roof-top unit (RTU) damage on Buildings 1-3 roofs. Although typically in our reports we critique opposing opinions after describing our own findings and conclusions, given the chronology of events and the comprehensive nature of the Nelson report, we believe it will assist the reader if we summarize our understanding of the Nelson report before proceeding further with our own narrative. Additional comments concerning the Nelson report are found in the footnotes.

// It is our understanding that another expert is issuing a report on the roof-top mechanical equipment, and accordingly we will limit our comments concerning hail damage to the equipment as follows:

// • Nelson substitutes "functional damage" as the litmus test for necessary repair in lieu of "direct physical damage" as used in most insurance policies. We consider evaporator fin damage caused by hail to be "direct physical damage" requiring restoration of the damaged material to a pre-loss condition. The evaporator fins on the A/C units are spaced about 15 fins/inch, a condition for which "fin combing" is a panacea with little chance of success. Besides, whenever the fins are visibly damaged, a check should be made to determine if the coils are leaking refrigerant.

// • We recommend replacing all hail-damaged fin/coil units. Typically, the fin and coil assembly is a single factory-made "off the shelf" unit. Replacing this unit requires removing the shroud, recovering the refrigerant, replacing the damaged fin/coil assemblies (braze don't solder), re-pressurize the system with nitrogen to test for leaks, evacuate the nitrogen and re-charge with refrigerant.

// • Nelson's opinions are based heavily on a study by Sitzmann, et. al., but Nelson fails to disclose that two of three authors are employees of Haag Engineering, a significant matter because (1) Haag is a forensic engineering company mostly employed by insurance companies and (2) Haag contributed "financial and technical support" to the study. In no way are we insinuating any impropriety. Our point is that the study's authors followed best practice for publication ethics by disclosing their relationship to Haag Engineering. In citing an academic study, Nelson should have included that information in its presentation of the material.

// SITE INSPECTION

// At the request of the Chad T. Wilson Law Firm, the undersigned representatives of [Company Name] inspected the 440 Plaza on October 2, 2014 (visual inspection); October 29-30 (visual inspection) and November 11-13 (visual inspection, moisture survey and destructive testing). Site inspection photos taken by us are enclosed in Attachment C. Unless otherwise indicated, the photos are representative of general conditions documented during the inspection. We presume that readers of this report are familiar with the Nelson report. Where we found the same conditions as Nelson, which are not consequential to the final analysis, we have omitted them from the narrative as a matter of brevity. However, we have retained in our file all photos depicting conditions we found, whether or not they appear in this report.

// MOISTURE SURVEY

// A non-destructive moisture survey was performed using a Tramex Deckscan capacitance moisture meter. The Deckscan meter records moisture readings relative to a presumed dry spot on a scale of 1-100. The results of the Deckscan survey are displayed in Attachment E using several formats. Diagram D1 reprises the building identification system shown in Attachment A. Diagrams D2-D4 show the moisture survey mapped over the entire complex. Diagrams D5-D6 illustrates the Tramex-Delmhorst correlation. Diagrams D6-D13 provide small scale maps bringing the survey data into better focus.

// • The full-color "rainbow" maps (such as D2) show moisture patterns based on the Deckscan readings on a scale of 1-100, with purple showing the driest conditions and red showing the areas with the greatest amount of entrapped moisture.

// • The blue & white "contour" maps (such as D3) show the areas of greatest concern. Since model building codes prohibit the installation of wood products with a moisture content greater than 19%, we used 20% WME (on the Delmhorst BD-2100 hand-held moisture meter) as the threshold for intervention. WME is defined as "the moisture level in any building material as if it were in close contact and in moisture equilibrium with wood expressed as a % moisture content of wood." Based on our field calibrations, we determined that for gravel-covered BUR systems, 20% WME correlated to 54.5% on the Deckscan and 30% WME with 83.1% on the Delmhorst. For Dura-Last systems, 20% WME correlated to 61.1% on the Deckscan and 30% WME with 93.8% on the Deckscan. The light blue areas on the contour maps delimit 20-30% WME. The dark blue areas delimit 30%+ WME.

// • Diagram D4 shows the correlation between the blue & white contours and interior ceiling damage (mapped at roof level).

// DESATURATION OF TEST CUTS

// We acquired six BUR samples and sent them for desaturation testing to RoofLeak Detection Company, Lake Worth, Florida. Unlike the Nelson lab tests, asphalt was fully removed from the specimens to facilitate microscopic examination with backlighting. At the time this report is written, lab reports have not been issued. In a November 29, 2014, phone conversation with Mr. Steve Thomas of RoofLeak, he stated that none of the samples showed fracture, but 3 of 6 samples showed evidence of inter-ply bruising caused by impacts. The samples are being returned to us for retention in our files. Given the number of roof cuts already made by Nelson, we are hesitant to make more. We reserve the right to desaturate Nelson's specimens to check for hail damage which may have escaped detection during their examination.

// DISCUSSION OF NELSON RECOMMENDATIONS

// We concur with Nelson's recommendation to remove the hail-damaged Duro-Last membranes on Roof Sections C, F, L, N, B1, E1, L1, M1 & N1 and install new membranes "as per applicable local building codes, manufacturer's recommendations, and industry standards". Killeen currently enforces the 2009 International Building Code (IBC) and 2009 International Energy Efficiency Code (IEEC). Section 1510 of the 2009 IBC requires:

// 1510.3 Recovering versus replacement. New roof coverings shall not be installed without first removing all existing layers of roof coverings down to the roof deck where any of the following conditions occur:
// 1. Where the existing roof or roof covering is water soaked or has deteriorated to the point that the existing roof or roof covering is not adequate as a base for additional roofing.
// 2. Where the existing roof covering is wood shake, slate, clay, cement or asbestos-cement tile.
// 3. Where the existing roof has two or more applications of any type of roof covering.

// Each of the Duro-Last membranes recommended for replacement by Nelson re-covers at least one other application of roof covering, i.e. "the existing roof has two or more applications of any type of roof covering". In order to comply with Section 1510, "all existing layers of roof coverings down to the roof deck" must be removed before a new roof covering is installed. In accordance with the 2009 IEEC, the new covering must include R-20 continuous insulation (c.i.). While field conditions and design intent will dictate the actual replacement product, for cost estimating purposes we recommend specifying 4-inch polyiso insulation (with taper), recover board and a new Duro-Last membrane. The cost estimates should include replacing all hail-damaged condenser fins, penetrations, flashings and water-damaged ceiling tiles.

// DISCUSSION OF ADDITIONAL RECOMMENDATIONS

// While we agree with Nelson that the hail-damaged Duro-Last membranes on C, F, L, N, B1, E1, L1, M1 & N1 should be removed and replaced with new membranes as per "the

// applicable local building codes, manufacturer's recommendations, and industry standards", we disagree with their assessment of the other roof sections as follows:

// ROOF SECTION A

// We did not find visible hail damage on the Duro-Last membrane or underlying insulation. The two large areas of entrapped moisture on the north side of Section A (which we found with the Deckscan) generally coincide with low spots where water tends to pond. Accordingly, we have removed these areas from consideration as damage which may have occurred during the March 28, 2014 date of loss. However, this does not explain the ten ceiling leaks located under areas of the roof where there is no evidence of ponding. Either water is seeping through hail-damaged flashing, wind-damaged lap seams, or it is leaking through repairs made to Nelson's test cuts. We recommend resealing all lap seams and patches, as well as replacing all hail-damaged condenser fins, penetrations, flashings, and water-damaged ceiling tiles.

// [Sections B through M content...]

// ROOF SECTIONS O & O1

// Sections O & O1 are covered with a Duro-Last membrane over polyiso board fully adhered to a plywood deck with a heavy flood coat of asphalt. The large area of entrapped moisture on lower section O results from poor drainage around the roof-mounted units. The smaller area of entrapped moisture on upper section O1 more likely results from wind-damaged lap seams. The membrane is fractured with hail hits similar to those found on Sections C, F, L and M. We recommend covering the membrane with recovery board and a new single-ply membrane. We also recommend adding 3 inches of polyiso to provide R-20 continuous insulation (c.i.), but since the original insulation will not be exposed during the construction, this is not required by code. The cost estimate should include replacing all hail-damaged condenser fins, penetrations and flashings.

// CONCLUSIONS & RECOMMENDATIONS

// We conclude that 440 Plaza was damaged by wind and hail on March 28, 2014 as described in this report. We summarize the recommendations made above as follows:

// [Table 3 content showing section-by-section recommendations]

// Table 3 is graphically portrayed in Attachment E. In addition to the recommendations in Table 3, we recommend replacing all hail-damaged condenser fins, penetrations, flashings, and water-damaged ceiling tiles.

// DISCLOSURES AND LIMITATIONS

// 1) Data referenced but not included in this report remains on file in the project folder.

// 2) [Company Name] reserves the right to review additional information such as meteorological data, eyewitness reports, construction drawings and project manuals as it becomes available and to revise this report based on the analysis of new information.

// 3) [Company Name] reserves the right to provide additional opinions upon request such as recommendations for repair.

// 4) Nothing in this report precludes the discovery of damage by others to include hidden or time-sensitive damage. Cost estimates for repair based on the description of damage provided in this report may require additional scope of work to allow for issues such as constructability, matching and compliance with law and ordinance. This document has not been prepared for regulatory approval, permitting or construction.

// FOOTNOTES

// 1) National Weather Service (NWS) reports from trained spotters indicate 1.5"-1.75" diameter hail within a 5-7 mile radius of 440 Plaza on the reported date of loss.

// 2) WeatherFusion, a second forensic weather company, reported 1.2" diameter hail.

// [Additional footnotes and references...]

// ATTACHMENTS

// Attachment A: Satellite images and aerial photos
// Attachment B: Weather data
// Attachment C: Site inspection photos
// Attachment D: Moisture survey
// Attachment E: Recommendations for repair
// Attachment F: Biographical sketches

// END OF REPORT 14-0129

// Respectfully submitted,

// [Signatures and credentials]
// `;




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
  const engineerName        = safeString(context?.engineerName);
  const engineerEmail       = safeString(context?.engineerEmail);
  const engineerLicense     = safeString(context?.engineerLicense);
  const engineerPhone       = safeString(context?.engineerPhone);
  const propertyOwnerName   = safeString(context?.propertyOwnerName);
  const projectName         = safeString(context?.projectName);

  // Affected areas
  const affectedAreas       = safeArrayJoin(context?.affectedAreas);

  // Summarize roof types from checkboxes
  let roofTypesDetected = '';
  if (context?.roofMetalChecked) {
    roofTypesDetected += 'Metal, ';
  }
  if (context?.roofCompChecked) {
    roofTypesDetected += 'Composition Shingles, ';
  }
  if (context?.roofSinglePlyChecked) {
    roofTypesDetected += 'Single-Ply Membrane, ';
  }
  if (context?.roofModBitChecked) {
    roofTypesDetected += 'Modified Bitumen, ';
  }
  if (context?.roofBURChecked) {
    roofTypesDetected += 'Built Up Roofing (Gravel Ballast), ';
  }
  if (context?.roofClayTileChecked) {
    roofTypesDetected += 'Clay Tile, ';
  }
  if (context?.roofConcreteTileChecked) {
    roofTypesDetected += 'Concrete Tile, ';
  }
  // remove trailing comma
  roofTypesDetected = roofTypesDetected.replace(/,\s*$/, '');

  // Weather data
  let weatherSummary = '';
  if (weatherData?.note) {
    weatherSummary = `Weather Data Note: ${weatherData.note}`;
  } else if (Object.keys(weatherData || {}).length > 0) {
    weatherSummary = JSON.stringify(weatherData, null, 2);
  }

  // Large system instruction
  const bigSystemInstruction = `
You are an expert forensic engineer generating professional report sections. 
Use only the data from user inputs; do not invent details that contradict them.
Utilize the engineer inputs and create sound, detailed, and objective arguments in defense of substantiating the claim.

Guidelines:
1. Use formal, technical language
2. Include specific context details
3. Maintain logical flow
4. Support conclusions with evidence
5. Reference documentation appropriately
6. Use unique phrasing
7. Ensure completeness
8. Incorporate custom instructions while maintaining standards
9. For the Table of Contents, use a clean, minimal layout in Markdown. Avoid bullet points and asterisks and hashtags.
10. Make it so that each section is as long and detailed as possible.
11. Make all the formatting uniform, with all the main headings the same font in bold, and all the rest of the text smaller font.
12. Utilize the engineer inputs and create sound, detailed, and objective arguments in defense of substantiating the claim.
13. Be lenghty and detailed throughout.

Key points:
1. Do NOT invent roofing types if user only specifies certain categories.
2. Do NOT mention multiple floors if user has not indicated that (avoid referencing an upper floor if not specified).
3. Keep Date of Loss (${dateOfLoss}) separate from Inspection Date (${investigationDate}).
4. If weather data is missing or the date was in the future, note that briefly rather than printing "N/A".
5. Avoid placeholders like [e.g., ...], [Third Party], etc.
6. The user’s claim types: ${claimTypeString}.
7. The indicated roof categories: ${roofTypesDetected}.
8. The property address: ${address}.
9. The property owner (or project name): ${propertyOwnerName} / ${projectName}.
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
Explain the purpose of the inspection (hail, wind, etc.).
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
Roof categories indicated: ${roofTypesDetected}.
Claim type(s): ${claimTypeString}.

Only mention what the user indicated. 
`,

    moisture: `
"Survey" (Moisture) section.
If user indicated interior water intrusion, mention it. Otherwise, be concise.
`,

    meteorologist: `
"Meteorologist Report" section.
Use the data:
${weatherSummary}
If not available or date is in the future, note it. 
`,

    conclusions: `
"Conclusions and Recommendations."
Summarize your final opinion on cause(s) of loss. 
Propose next steps or repairs if relevant.
`,

    rebuttal: `
"Rebuttal" section. 
If no third-party or conflicting reports were indicated, keep minimal. 
Otherwise, address them if user provided details.
`,

    limitations: `
"Limitations" section.
Typical disclaimers about data reliance, scope boundaries, site access, etc.
No placeholders.
`,

    tableofcontents: `
"Table of Contents" in markdown, headings in this order:
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
