{% macro generate_schema_name(custom_schema_name, node) -%}
    {#- Use the model's custom schema directly, without prepending the profile schema.
        This lets each industry control its own output schema name completely.
        e.g., agriculture models output to AGRICULTURE_STAGING, not PHARMA_AGRICULTURE_STAGING. -#}
    {%- if custom_schema_name is not none -%}
        {{ custom_schema_name | trim }}
    {%- else -%}
        {{ target.schema }}
    {%- endif -%}
{%- endmacro %}
