---
title: XR Pointclouds
description: Australian Plant Phenomics Facility at ANU
id: XRPointclouds
imgURL: assets/images/xrPointclouds.png
year: 2021

stack: C#, Unity, Mixed Reality Toolkit, Python, Jupyter Notebook, Firebase, Git, HoloLens 2
modalImgURL:  assets/images/DemoGifs/xrPointclouds.gif
findOutMoreURL: https://gitlab.com/appf-anu/APPF-ANU-VR-Projects/xr-pointclouds
githubURL: https://gitlab.com/appf-anu/APPF-ANU-VR-Projects/xr-pointclouds
show: true
tags: project SoftEng XR
category: project

--- 
  Developed a system to visualise pointcloud data on the HoloLens 2.

  Initial problem was to allow HoloLens to be able to accurately represent pointcloud data, including those with large file sizes. Allowing XR application to be able to read .ply files appropriately was the first issue. Following this, I also implemented novel interaction techniques to the visualised pointcloud, allowing grabbing, scaling and rotating. 

  Building on top of this XR application, I also developed a system to allow transfer of pointcloud .ply file data from a Desktop to a HoloLens 2 in a distributed manner. To accomplish this, I had a Firebase Cloud API to store URLs of pointcloud files available on the APPF servers. The HoloLens 2 app simply polls the API periodically and is able to fetch all the source URLs. Once a source URL is found, the user is able to click on it within the app and allow it to download and visualise the pointcloud file. 
