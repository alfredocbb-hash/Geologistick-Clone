ALTER TABLE ml_status_mapping 
ADD CONSTRAINT ml_status_mapping_unique_status 
UNIQUE (ml_status, ml_substatus);