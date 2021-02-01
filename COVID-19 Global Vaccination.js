// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: syringe;

////////////////////////////////////////////////
// Configuration ///////////////////////////////
////////////////////////////////////////////////
let cacheInvalidationInMinutes = 60

let smallWidgetWidth = 121
let padding = 14
let barWidth = smallWidgetWidth - 2 * padding
let barHeight = 3

let formatter = new DateFormatter()
formatter.locale = "en"
formatter.dateFormat = "MMM d"

let country = {
    germany: "DE",
    canada: "CA",
    usa: "US"
}

let iso3Conversion = {
    "DE": "DEU",
    "CA": "CAN",
    "US": "USA"
}

////////////////////////////////////////////////
// Data ////////////////////////////////////////
////////////////////////////////////////////////
let today = new Date()

let flag = {
    "DE": "🇩🇪",
    "CA": "🇨🇦",
    "US": "🇺🇸"
}

// Vaccination Data ////////////////////////////
let vaccinationResponseMemoryCache
let vaccinationData = {}

await loadVaccinationData(country.germany)
await loadVaccinationData(country.canada)
await loadVaccinationData(country.usa)

// Uncomment the following line to log all the collected data at this point.
debugLogRawData()

////////////////////////////////////////////////
// Widget //////////////////////////////////////
////////////////////////////////////////////////
let widget = new ListWidget()
widget.setPadding(padding, padding, padding, padding)
await createWidget()

////////////////////////////////////////////////
// Script //////////////////////////////////////
////////////////////////////////////////////////
Script.setWidget(widget)
Script.complete()
if (config.runsInApp) {
    widget.presentSmall()
}

////////////////////////////////////////////////
// Widget Creation /////////////////////////////
////////////////////////////////////////////////
async function createWidget() {
    let canvas = widget.addStack()
    canvas.layoutVertically()
    displayTitle(canvas)
    canvas.addSpacer()
    displayContent(canvas)
    canvas.addSpacer()
    displayFooter(canvas)
}

// Title ///////////////////////////////////////
function displayTitle(canvas) {
    let title = canvas.addText("Vaccination".toUpperCase())
    title.font = Font.semiboldRoundedSystemFont(13)
    title.textColor = Color.dynamic(Color.darkGray(), Color.lightGray())
}

// Content /////////////////////////////////////
function displayContent(canvas) {
    displayCountry(canvas, country.germany)
    canvas.addSpacer()
    displayCountry(canvas, country.canada)
    canvas.addSpacer()
    displayCountry(canvas, country.usa)
}

// Content Row /////////////////////////////////
function displayCountry(canvas, country) {
    displayInformation(canvas, country)
    canvas.addSpacer(2)
    displayProgressBar(canvas, country)
}

// Country Data ////////////////////////////////
function displayInformation(canvas, country) {
    let informationContainer = canvas.addStack()
    informationContainer.layoutHorizontally()
    displayFlag(informationContainer, country)
    informationContainer.addSpacer()
    displayNewVaccinations(informationContainer, country)
    displayPercentage(informationContainer, country)
}

// Flag ////////////////////////////////////////
function displayFlag(canvas, country) {
    let flagLabel = canvas.addText(flag[country])
    flagLabel.font = Font.regularRoundedSystemFont(13)
}

// New Vaccinations ////////////////////////////
function displayNewVaccinations(canvas, country) {
    let smallLabelContainer = canvas.addStack()
    smallLabelContainer.layoutVertically()
    smallLabelContainer.addSpacer(3)
    let numberFormatter = new Intl.NumberFormat('en', { style: 'decimal', useGrouping: true })
    let newVaccinations = vaccinationData[country].new_vaccinations
    let vaccinationLabel = smallLabelContainer.addText(" + " + numberFormatter.format(newVaccinations).replaceAll(",", "."))
    vaccinationLabel.textColor = Color.dynamic(Color.darkGray(), Color.lightGray())
    vaccinationLabel.font = Font.regularRoundedSystemFont(8)
}

// Total Vaccination Percentage ////////////////
function displayPercentage(canvas, country) {
    let percentageContainer = canvas.addStack()
    percentageContainer.size = new Size(50, 0)
    percentageContainer.layoutHorizontally()
    percentageContainer.addSpacer()
    let vaccinationPercentage = vaccinationData[country].total_vaccinations_per_hundred
    let percentageLabel = percentageContainer.addText(vaccinationPercentage.toFixed(1) + "%")
    percentageLabel.font = Font.mediumRoundedSystemFont(13)
    percentageLabel.minimumScaleFactor = 0.8
    percentageLabel.lineLimit = 1
}

// Vaccination Progress Bar ////////////////////
function displayProgressBar(canvas, country) {
    let vaccinationPercentage = vaccinationData[country].total_vaccinations_per_hundred
    let progressBar = canvas.addImage(drawProgressBar(vaccinationPercentage))
    progressBar.cornerRadius = barHeight / 2
}

// Progress Bar Creation ///////////////////////
function drawProgressBar(percentage) {
    // Total Vaccination Target in Percent
    let target = {
        good: 60,
        perfect: 70
    }

    // Drawing Canvas
    let canvas = new DrawContext()
    canvas.size = new Size(barWidth, barHeight)
    canvas.opaque = false
    canvas.respectScreenScale = true

    // Bar Container
    canvas.setFillColor(Color.gray())
    let bar = new Path()
    let backgroundRect = new Rect(0, 0, barWidth, barHeight)
    bar.addRect(backgroundRect)
    canvas.addPath(bar)
    canvas.fillPath()

    // Progress Bar Color depending on vaccination status
    let color
    if (percentage >= target.perfect) {
        color = Color.green()
    } else if (percentage >= target.good) {
        color = Color.orange()
    } else {
        color = Color.red()
    }

    // Progress Bar
    canvas.setFillColor(color)  
    let progress = new Path()
    let quotient = percentage / 100
    let progressWidth = Math.min(barWidth, barWidth * quotient) // Makes breaking the scale impossible although barWidth * quotient should suffice
    progress.addRect(new Rect(0, 0, progressWidth, barHeight))
    canvas.addPath(progress)
    canvas.fillPath()

    return canvas.getImage()
}

// Footer //////////////////////////////////////
function displayFooter(canvas) {
    let updateDictionary = getUpdateDictionary()

    let sortedUpdates = Object.keys(updateDictionary).sort().reverse() // newest first
    let updateInfoArray = sortedUpdates.map(k => relativeTimestamp(new Date(k)))
    let updateInfoText = updateInfoArray.join(', ')

    let lastUpdateLabel = canvas.addText("Last Update: " + updateInfoText)
    lastUpdateLabel.font = Font.mediumRoundedSystemFont(10)
    lastUpdateLabel.textColor = Color.dynamic(Color.lightGray(), Color.darkGray())
}

function getUpdateDictionary() {
    let updateFormatter = new DateFormatter()
    updateFormatter.locale = "en"
    updateFormatter.dateFormat = "yyyy-MM-dd"

    let updateDict = {}

    let owidUpdates = [getLastOWIDUpdate(country.germany), getLastOWIDUpdate(country.canada), getLastOWIDUpdate(country.usa)]
    let oldestGlobalVaccinationsUpdate = owidUpdates.sort().reverse()[0]
    if (!updateDict[updateFormatter.string(oldestGlobalVaccinationsUpdate)]) {
        updateDict[updateFormatter.string(oldestGlobalVaccinationsUpdate)] = []
    }
    updateDict[updateFormatter.string(oldestGlobalVaccinationsUpdate)].push("OWID")

    return updateDict
}

////////////////////////////////////////////////
// Calculations ////////////////////////////////
////////////////////////////////////////////////
function getLastOWIDUpdate(country) {
    let lastUpdate = new Date(vaccinationData[country].last_updated_date)
    // Since vaccinations are always reported at the end of the day, we add 1 day here (data from yesterday = last update today)
    lastUpdate.setDate(lastUpdate.getDate() + 1)
    // If data gets reported before midnight, the last update should still be today instead of tomorrow.
    return lastUpdate.getTime() > today.getTime() ? today : lastUpdate
}

function relativeTimestamp(date) {
    let yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    switch (formatter.string(date)) {
        case formatter.string(today):
            return "Today"
        case formatter.string(yesterday):
            return "Yesterday"
        default:
            return formatter.string(date)
    }
}
  
function sum(a, b) {
    return a + b
}

////////////////////////////////////////////////
// Networking //////////////////////////////////
////////////////////////////////////////////////
async function loadVaccinationData(country) {
    let files = FileManager.local()
    let cachePath = files.joinPath(files.cacheDirectory(), "api-cache-ourworldindata-latest-" + country)
    let cacheExists = files.fileExists(cachePath)
    let cacheDate = cacheExists ? files.modificationDate(cachePath) : 0

    try {
        // Use Cache if available and last updated within specified `cacheInvalidationInMinutes
        if (cacheExists && (today.getTime() - cacheDate.getTime()) < (cacheInvalidationInMinutes * 60 * 1000)) {
            console.log("Global Vaccination Data: Using cached Data")
            vaccinationData[country] = JSON.parse(files.readString(cachePath))
        } else {
            console.log("Global Vaccination Data: Updating cached Data")
            if (vaccinationResponseMemoryCache) {
                vaccinationData[country] = vaccinationResponseMemoryCache[iso3Conversion[country]]
            } else {
                let response = await new Request('https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/latest/owid-covid-latest.json').loadJSON()
                vaccinationData[country] = response[iso3Conversion[country]]
            }
            files.writeString(cachePath, JSON.stringify(vaccinationData[country]))
        }
    } catch (error) {
        console.error(error)
        if (cacheExists) {
            console.log("Global Vaccination Data: Loading new Data failed, using cached as fallback")
            vaccinationData[country] = JSON.parse(files.readString(cachePath))
        } else {
            console.log("Global Vaccination Data: Loading new Data failed and no Cache found")
        }
    }
}

////////////////////////////////////////////////
// Date Calculation ////////////////////////////
////////////////////////////////////////////////
// --> see stackoverflow.com/a/11252167/6333824

function treatAsUTC(date) {
    var result = new Date(date)
    result.setMinutes(result.getMinutes() - result.getTimezoneOffset())
    return result
}

function daysBetween(startDate, endDate) {
    var millisecondsPerDay = 24 * 60 * 60 * 1000
    return Math.round((treatAsUTC(endDate) - treatAsUTC(startDate)) / millisecondsPerDay)
}

////////////////////////////////////////////////
// Debug ///////////////////////////////////////
////////////////////////////////////////////////

function debugLogRawData() {
    console.log("\n\n**Global Vaccination Data**\n")
    console.log(JSON.stringify(vaccinationData, null, 2))
}




////////////////////////////////////////////////
// Author: Benno Kress /////////////////////////
// Original: Benno Kress ///////////////////////
// github.com/bennokress/Scriptable-Scripts ////
// Please copy every line! /////////////////////
////////////////////////////////////////////////