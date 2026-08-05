# Databricks App Homework Submission

## Your Databricks App URL

[Lakebase Support Board](https://lakebase-support-board-7474651690783296.aws.databricksapps.com/)

## Screenshot of the deployed application

![Deployed Lakebase Support Board](picture/front-page.png)

## Screenshot showing the Lakebase tables and sample records

![Lakebase tables and sample records](picture/lakebase.png)

## Reflection

### What was the most difficult part?

The most difficult part was figuring out how to configure the Lakebase connection for a Databricks App.

### How is Lakebase different from storing this data in a traditional analytics table?

At this stage, I did not notice a major difference compared with storing the data in a traditional PostgreSQL database, although having the application and database together in one platform should make the overall setup easier. I expect features such as Change Data Feed (CDF) and Agent Bricks could provide important benefits, but that is still an assumption because I have not used them yet.

### What feature would you add next?

I would add document uploads stored in an S3-compatible bucket, restructure the database to support multiple projects or boards with user roles, and implement CDF.
