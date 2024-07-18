#!/usr/bin/env node

/* Copyright (C) Actionbound GbR - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Joantahn Rauprich <joni@actionbound.de>, August 2016
 */

const path = require('path')
const fs = require('node:fs/promises')
const { Readable } = require('stream')
const { finished } = require('stream/promises')

async function downloadFile (url, fileName) {
  process.stdout.write(`Downloading ${path.basename(url)}`)
  let file
  try {
    // check if file exists
    let exits = false 
    try {
      await fs.access(fileName)
      exits = true
    } catch (e) { }
    if(exits) {
      process.stdout.write(` allready there\n`)
      return
    }
    const res = await fetch(url)
    file = await fs.open(fileName, 'wx')
    const fileStream = file.createWriteStream(fileName)
    await finished(Readable.fromWeb(res.body).pipe(fileStream))
    process.stdout.write(` done\n`)
  }
  catch (e) {
    process.stdout.write(` failed\n`)
    console.error(e)
    // throw error up
    throw e
  }
  finally {
    file?.close()
  }
}

const argv = require('optimist')
  .usage('Usage: $0 --out DIRECTORY URL...')
  .demand(['o', 1])
  .alias('o', 'out')
  .describe('o', 'Output directory (mobile/whitelabel/XX/merge')
  .argv

const API_HOST = 'https://actionbound.com/api/2.12/'
MEDIA_CAPABLE_FIELDS = ['content', 'problem', 'description', 'ceremony', 'element_css', 'blank-text']

// just look for anything from content.actionbound.com inside ' or ""
const MEDIA_RE = /['"](https:\/\/content.actionbound.com\/[^'"]+)['"]/g

async function downloadBound(boundUrl, revision) {
  const boundInfo = await (await fetch(`${API_HOST}bounds?url=${boundUrl}`)).json()
  if(boundInfo.length !== 1) {
    console.error(`Bound not found: ${boundUrl}`)
    return
  }
  console.log(`Got Bound: ${boundInfo[0].title} https://actionbound.com/${boundUrl}`)
  const url = `${API_HOST}bound/${boundUrl}/${revision ? revision : boundInfo[0]._revision_id}`
  const bound = await (await fetch(url)).json()
  
  const allFiles = []
  for(const element of bound.content) {
    for(const field of MEDIA_CAPABLE_FIELDS) {
      if(field in element) {
        for(const match of element[field].matchAll(MEDIA_RE)) {
          allFiles.push(match[1])
        }
      }
    }
  }

  if(bound.translations) {
    for(const locale of Object.keys(bound.translations)) {
      for(const key of Object.keys(bound.translations[locale])) {
        for(const match of bound.translations[locale][key].matchAll(MEDIA_RE)) {
          allFiles.push(match[1])
        }
      }
    }
  }

  const filesToDownload = [...new Set(allFiles)]
  const fileReplacments = {}

  for(const file of filesToDownload) {
    // make directory if it doesn't exist
    const filePath = path.resolve(argv.out, 'public', 'img', 'bounds', boundUrl)
    await fs.mkdir(filePath, { recursive: true })
    const destination = path.resolve(filePath, path.basename(file))
    try {
      await downloadFile(file, destination)
      fileReplacments[file] = `img/bounds/${boundUrl}/${path.basename(file)}`
    } catch(e) {
      // allready handled in downloadFile
    }
  }	

  for(const element of bound.content) {
    for(const field of MEDIA_CAPABLE_FIELDS) {
      if(field in element) {
        for(const file of filesToDownload) {
          const re = new RegExp(file, 'g')
          element[field] = element[field].replace(re, fileReplacments[file])
        }
      }
    }
  }

  
  if(bound.translations) {
    for(const locale of Object.keys(bound.translations)) {
      for(const key of Object.keys(bound.translations[locale])) {
        for(const match of bound.translations[locale][key].matchAll(MEDIA_RE)) {
          for(const file of filesToDownload) {
            const re = new RegExp(file, 'g')
            bound.translations[locale][key] = bound.translations[locale][key].replace(match[1], fileReplacments[match[1]])
          }
        }
      }
    }
  }

  const jsonPath = path.resolve(argv.out, 'app', 'assets', 'javascripts', 'actionbound', 'bounds')
  await fs.mkdir(jsonPath, { recursive: true })
  await fs.writeFile(
    path.resolve(jsonPath, `${boundUrl}.js`),
    `Actionbound.Bounds['${boundUrl}']=${JSON.stringify(bound, null, 2)}`
  )
  console.log(`Bound ${boundUrl} downloaded`)
}

async function main() {
  for(const bound of argv._) {
    let boundUrl = bound 
    let revision
    if(bound.includes('/')) {
      [boundUrl, revision] = bound.split('/')
    }
    await downloadBound(boundUrl, revision)
  }
}

main()

